import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ReflectionStep } from '@/features/ritual/components/ReflectionStep'
import type { RitualDay } from '@/data/types'
import { localDateString } from '@/shared/lib/dates'

// Force reduced-motion so the rz-* entrance choreography never masks content under jsdom
// (stubReduced pattern, DayStoryStep.test.tsx precedent).
function stubReduced(matches = true) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches,
    media: q,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Unlike its sibling acts, this one is asserted through the REAL data layer in both modes —
// mock mode patches the ['ritualDay', date] cache directly, real mode goes through the default
// MSW `PUT /api/ritual/reflection` handler (test/msw/handlers.ts) which echoes the prose back.
// Both land in the same cache entry, so one assertion covers both modes.
const today = localDateString()

let qc: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

/** The day read must be settled before typing: in real mode an in-flight initial GET
 *  resolving AFTER the save would otherwise stomp the freshly-written reflectionText.
 *  In mock mode `initialData` makes this immediate. */
async function readySettled() {
  await waitFor(() => expect(qc.getQueryState(['ritualDay', today])?.status).toBe('success'))
}

beforeEach(() => {
  stubReduced()
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('ReflectionStep', () => {
  test('renders the eyebrow, the headline and the placeholder', async () => {
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    expect(screen.getByText('Ma milyen volt')).toBeInTheDocument()
    expect(screen.getByText('Milyen volt a napod valójában?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Írd le, ahogy volt — senki más nem olvassa…')).toBeInTheDocument()
  })

  test('advances without writing anything when skipped', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.click(screen.getByRole('button', { name: 'Ma nem írok' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('skipping AFTER typing still writes nothing — the skip is a true opt-out', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Meggondoltam magam.')
    await user.click(screen.getByRole('button', { name: 'Ma nem írok' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('advances on Tovább with an empty textarea and writes nothing', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('saves the prose and advances on Tovább', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Nehéz nap volt.')
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    // the advance is immediate — it never waits on the write (IDENT-3: a failed save must
    // not trap the user inside the ritual)
    expect(onNext).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBe('Nehéz nap volt.')
    })
  })

  test('typing alone never writes — the save happens on advance, not on keystroke', async () => {
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Csak gépelek.')

    // No debounce/autosave: the backend's ReflectionEmbeddingListener is justified by
    // "embedded only on close, never on every keystroke-save" — a keystroke write could race
    // the close's embed insert.
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('seeds the textarea from the day already-written reflectionText', async () => {
    qc.setQueryData<RitualDay>(['ritualDay', today], {
      date: today,
      closed: false,
      closedAt: null,
      reflectionText: 'Tegnap ezt írtam.',
      window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
    })
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })

    expect(screen.getByRole('textbox', { name: /napod/i })).toHaveValue('Tegnap ezt írtam.')
  })
})
