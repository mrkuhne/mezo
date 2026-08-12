import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { QueryWrapper } from '@/test/queryWrapper'
import { localDateString } from '@/shared/lib/dates'
import type { IntentionDay } from '@/data/types'

// `useIntentionDay` is a spy that DELEGATES to the real dual-mode hook by default (so the
// happy-path cases still exercise the data layer in whichever ambient mode the gate runs),
// and is overridden per-test for the two ghost shapes — `isPending` / empty days that mock
// mode can never produce. The hook itself has its own tests (intentionHooks.test.tsx).
const hooks = vi.hoisted(() => ({
  useIntentionDay: vi.fn(),
  real: { fn: null as unknown as (d: string) => { data: IntentionDay; isPending: boolean } },
}))
vi.mock('@/data/hooks', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/data/hooks')>()
  hooks.real.fn = orig.useIntentionDay
  return { ...orig, useIntentionDay: hooks.useIntentionDay }
})

const EMPTY: IntentionDay = { date: '2026-07-20', creed: null, foci: [], reflection: null, focusCap: 3 }

const renderChip = () => render(<QueryWrapper><IntentionBanner variant="chip" /></QueryWrapper>)
const renderReflect = () => render(<QueryWrapper><IntentionBanner variant="reflect" /></QueryWrapper>)

/**
 * Renders the chip against a QueryClient PRE-SEEDED with `day`, so the write path
 * (`useIntentionActions` → `qc.setQueryData`) and the read path (`useIntentionDay`) share one
 * live cache. `initialData` only applies when the key is empty, so the seed wins over the mock
 * day — that is how a "creed + zero foci" start state is reachable at all.
 */
function renderChipWithDay(day: IntentionDay) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['intentionDay', localDateString()], day)
  return render(
    <QueryClientProvider client={client}>
      <IntentionBanner variant="chip" />
    </QueryClientProvider>,
  )
}

describe('IntentionBanner', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    hooks.useIntentionDay.mockImplementation((d: string) => hooks.real.fn(d))
  })
  afterEach(() => vi.unstubAllEnvs())

  describe('variant="chip"', () => {
    test('shows the creed and the day\'s foci with a + Mai fókusz CTA', () => {
      const { container } = renderChip() // seed: creed + 2 foci, cap 3
      expect(container.querySelector('.td-list')).toBeTruthy()
      // the n / cap count lives in the section header now (no floating pill)
      expect(container.querySelector('.td-sech b')?.textContent).toBe('Fókusz · 2 / 3')
      expect(screen.getByText(/szándékkal élek/i)).toBeInTheDocument()
      // the day's stated intentions are OUTPUT, not just input (mezo-j7u4 fix round 2)
      expect(container.querySelectorAll('.td-row')).toHaveLength(2)
      expect(screen.getByText(/Jelen lenni minden beszélgetésben/)).toBeInTheDocument()
      expect(screen.getByText(/a formára figyelek/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Fókusz hozzáadása/ })).toBeInTheDocument()
    })

    test('the WHOLE add-a-focus path: + Mai fókusz → type → save → the focus is rendered', async () => {
      const { container } = renderChipWithDay({
        date: localDateString(), creed: 'Szándékkal élek.', foci: [], reflection: null, focusCap: 3,
      })
      // zero foci: nothing to show yet, and the header carries no count
      expect(container.querySelectorAll('.td-row')).toHaveLength(0)
      expect(container.querySelector('.td-sech b')?.textContent).toBe('Fókusz')

      await userEvent.click(screen.getByRole('button', { name: /Fókusz hozzáadása/ }))
      await userEvent.type(await screen.findByRole('textbox'), 'Ma végig jelen leszek')
      await userEvent.click(screen.getByRole('button', { name: 'Hozzáadom' }))

      expect(await screen.findByText('Ma végig jelen leszek')).toBeInTheDocument()
      expect(container.querySelectorAll('.td-row')).toHaveLength(1)
      expect(container.querySelector('.td-sech b')?.textContent).toBe('Fókusz · 1 / 3')
    })

    test('foci render even without a creed (RoutineCard\'s sheet can produce those)', () => {
      const { container } = renderChipWithDay({
        date: localDateString(), creed: null, focusCap: 3, reflection: null,
        foci: [{ id: 'a', focusDate: localDateString(), text: 'Creed nélküli fókusz' }],
      })
      expect(screen.getByText('Creed nélküli fókusz')).toBeInTheDocument()
      expect(container.querySelectorAll('.td-row')).toHaveLength(1)
    })

    test('opens the focus sheet from the + Mai fókusz button', async () => {
      renderChip()
      await userEvent.click(screen.getByRole('button', { name: /Fókusz hozzáadása/ }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
    })

    test('the creed text itself opens the CreedSheet (its only entry point)', async () => {
      renderChip()
      await userEvent.click(screen.getByRole('button', { name: 'Vezérelv szerkesztése' }))
      expect(await screen.findByRole('dialog')).toBeInTheDocument()
    })

    test('no creed yet: the prompt + a Vezérelv megírása CTA instead', () => {
      hooks.useIntentionDay.mockReturnValue({ data: EMPTY, isPending: false })
      renderChip()
      expect(screen.getByText(/Fogalmazd meg az irányt/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '+ Vezérelv megírása' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Fókusz hozzáadása/ })).not.toBeInTheDocument()
    })

    test('at the daily focus cap the add CTA is withdrawn — never a dead control', () => {
      hooks.useIntentionDay.mockReturnValue({
        data: { ...EMPTY, creed: 'x', focusCap: 2, foci: [
          { id: 'a', focusDate: EMPTY.date, text: 'a' }, { id: 'b', focusDate: EMPTY.date, text: 'b' },
        ] },
        isPending: false,
      })
      const { container } = renderChip()
      expect(screen.queryByRole('button', { name: /Fókusz hozzáadása/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Vezérelv szerkesztése' })).toBeInTheDocument()
      // ...but the foci at the cap are still displayed, and counted
      expect(container.querySelector('.td-sech b')?.textContent).toBe('Fókusz · 2 / 2')
      expect(screen.getByText('a')).toBeInTheDocument()
      expect(screen.getByText('b')).toBeInTheDocument()
    })

    test('ghosts while pending with no creed and no foci (real mode before data)', () => {
      hooks.useIntentionDay.mockReturnValue({ data: EMPTY, isPending: true })
      const { container } = renderChip()
      expect(container.querySelector('.td-list')).toBeNull()
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('variant="reflect"', () => {
    test('renders the reflection question and the three options', () => {
      renderReflect()
      expect(screen.getByText('Szándékkal élted a napot?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Igen' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Részben' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Nem' })).toBeInTheDocument()
    })

    test('once reflected it collapses to the ✓ done line', () => {
      hooks.useIntentionDay.mockReturnValue({
        data: { ...EMPTY, creed: 'x', reflection: 'partial', foci: [{ id: 'a', focusDate: EMPTY.date, text: 'a' }] },
        isPending: false,
      })
      renderReflect()
      expect(screen.getByText(/✓ Részben — a mai szándékodra reflektáltál\./)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Igen' })).not.toBeInTheDocument()
    })

    test('ghosts without foci', () => {
      hooks.useIntentionDay.mockReturnValue({ data: { ...EMPTY, creed: 'x' }, isPending: false })
      const { container } = renderReflect()
      expect(container).toBeEmptyDOMElement()
    })

    test('ghosts without a creed', () => {
      hooks.useIntentionDay.mockReturnValue({
        data: { ...EMPTY, foci: [{ id: 'a', focusDate: EMPTY.date, text: 'a' }] },
        isPending: false,
      })
      const { container } = renderReflect()
      expect(container).toBeEmptyDOMElement()
    })
  })
})
