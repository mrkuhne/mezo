import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { ReflectionStep } from '@/features/ritual/components/ReflectionStep'
import { API_BASE } from '@/data/_client/api'
import type { RitualDay } from '@/data/types'
import { server } from '@/test/msw/server'
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

// Unlike its sibling acts, this one runs against the REAL data layer in both modes — mock mode
// patches the ['ritualDay', date] cache directly, real mode goes through the default MSW
// `PUT /api/ritual/reflection` handler (test/msw/handlers.ts) which echoes the prose back. Both
// land in the same cache entry, so one assertion covers both modes.
//
// `useRitualActions` is wrapped rather than REPLACED: the wrapper calls the real hook and simply
// records each `saveReflection` invocation on the way through. That is what lets the four
// transitions below assert "no write happened at all" — a cache-content assertion cannot tell a
// skipped write apart from a write that stored the identical value.
const spies = vi.hoisted(() => ({ saveReflection: vi.fn() }))
vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useRitualActions: (date: string) => {
      const real = actual.useRitualActions(date)
      return {
        ...real,
        saveReflection: (text: string) => {
          spies.saveReflection(text)
          return real.saveReflection(text)
        },
      }
    },
  }
})

const today = localDateString()
const PRIOR = 'Tegnap ezt írtam.'

const dayWith = (reflectionText: string | null) => ({
  date: today,
  closed: false,
  closedAt: null,
  reflectionText,
  window: { opensAt: '21:15', prepStartsAt: '21:45', bedTime: '22:30' },
})

let qc: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

/** Give the act a day that ALREADY carries prose, consistently in both modes: the cache seeds
 *  the first render, and the GET override keeps real mode's refetch-on-mount from erasing it. */
function seedPriorProse() {
  qc.setQueryData<RitualDay>(['ritualDay', today], dayWith(PRIOR))
  server.use(http.get(`${API_BASE}/api/ritual/day/${today}`, () => HttpResponse.json(dayWith(PRIOR))))
}

/** The day read must be settled before typing: in real mode an in-flight initial GET resolving
 *  AFTER the save would otherwise stomp the freshly-written reflectionText. In mock mode
 *  `initialData` + `staleTime: Infinity` make this immediate. */
async function readySettled(reflectionText: string | null = null) {
  await waitFor(() => {
    const state = qc.getQueryState(['ritualDay', today])
    expect(state?.status).toBe('success')
    expect(state?.fetchStatus).toBe('idle')
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText ?? null).toBe(reflectionText)
  })
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

  // ── The four seed × edit transitions. „Tovább" writes iff the prose CHANGED against the seed.

  test('(a) no prior prose + empty advance → writes nothing', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(spies.saveReflection).not.toHaveBeenCalled()
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('(b) no prior prose + typed → saves the trimmed prose, and advances without waiting', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Nehéz nap volt.')
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    // the advance is immediate — it never waits on the write (IDENT-3: a failed save must
    // not trap the user inside the ritual)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(spies.saveReflection).toHaveBeenCalledTimes(1)
    expect(spies.saveReflection).toHaveBeenCalledWith('Nehéz nap volt.')
    await waitFor(() => {
      expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBe('Nehéz nap volt.')
    })
  })

  test('(c) prior prose + unchanged → writes nothing (no redundant identical re-PUT)', async () => {
    seedPriorProse()
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled(PRIOR)

    expect(screen.getByRole('textbox', { name: /napod/i })).toHaveValue(PRIOR)
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(spies.saveReflection).not.toHaveBeenCalled()
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBe(PRIOR)
  })

  test('(d) prior prose + emptied → CLEARS it, so the close can never embed prose the user took back', async () => {
    seedPriorProse()
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled(PRIOR)

    await user.clear(screen.getByRole('textbox', { name: /napod/i }))
    await user.click(screen.getByRole('button', { name: 'Tovább' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    // '' is the CLEAR payload — the backend's `text.isBlank() ? null`, the mock branch's
    // `text.trim() || null` and the MSW default all map it to null.
    expect(spies.saveReflection).toHaveBeenCalledTimes(1)
    expect(spies.saveReflection).toHaveBeenCalledWith('')
    await waitFor(() => {
      expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeNull()
    })
  })

  // ── „Ma nem írok" — a true opt-out, never a clear.

  test('advances without writing anything when skipped', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<ReflectionStep onNext={onNext} />, { wrapper })
    await readySettled()

    await user.click(screen.getByRole('button', { name: 'Ma nem írok' }))

    expect(onNext).toHaveBeenCalledTimes(1)
    expect(spies.saveReflection).not.toHaveBeenCalled()
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
    expect(spies.saveReflection).not.toHaveBeenCalled()
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('skipping an EMPTIED box leaves the stored prose alone — skip means "do not touch today"', async () => {
    seedPriorProse()
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled(PRIOR)

    await user.clear(screen.getByRole('textbox', { name: /napod/i }))
    await user.click(screen.getByRole('button', { name: 'Ma nem írok' }))

    expect(spies.saveReflection).not.toHaveBeenCalled()
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBe(PRIOR)
  })

  // ── No autosave, and a seed that never fights the typist.

  test('typing alone never writes — the save happens on advance, not on keystroke', async () => {
    const user = userEvent.setup()
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })
    await readySettled()

    await user.type(screen.getByRole('textbox', { name: /napod/i }), 'Csak gépelek.')

    // No debounce/autosave: the backend's ReflectionEmbeddingListener is justified by
    // "embedded only on close, never on every keystroke-save" — a keystroke write could race
    // the close's embed insert.
    expect(spies.saveReflection).not.toHaveBeenCalled()
    expect(qc.getQueryData<RitualDay>(['ritualDay', today])?.reflectionText).toBeFalsy()
  })

  test('seeds the textarea from the day already-written reflectionText', () => {
    qc.setQueryData<RitualDay>(['ritualDay', today], dayWith(PRIOR))
    render(<ReflectionStep onNext={vi.fn()} />, { wrapper })

    expect(screen.getByRole('textbox', { name: /napod/i })).toHaveValue(PRIOR)
  })
})
