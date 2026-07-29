import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { IntentionBanner } from '@/features/today/components/IntentionBanner'
import { QueryWrapper } from '@/test/queryWrapper'
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

describe('IntentionBanner', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    hooks.useIntentionDay.mockImplementation((d: string) => hooks.real.fn(d))
  })
  afterEach(() => vi.unstubAllEnvs())

  describe('variant="chip"', () => {
    test('shows the creed in one line with a + Mai fókusz CTA', () => {
      const { container } = renderChip()
      expect(container.querySelector('.creedchip')).toBeTruthy()
      expect(screen.getByText(/szándékkal élek/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Fókusz hozzáadása/ })).toBeInTheDocument()
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
      renderChip()
      expect(screen.queryByRole('button', { name: /Fókusz hozzáadása/ })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Vezérelv szerkesztése' })).toBeInTheDocument()
    })

    test('ghosts while pending with no creed and no foci (real mode before data)', () => {
      hooks.useIntentionDay.mockReturnValue({ data: EMPTY, isPending: true })
      const { container } = renderChip()
      expect(container.querySelector('.creedchip')).toBeNull()
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
