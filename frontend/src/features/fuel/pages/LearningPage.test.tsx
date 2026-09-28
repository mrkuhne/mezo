// ============================================================
// Mezo · LearningPage tests (mezo-3n2so, spec §5.3) — „Hogy tanultam?” at /fuel/tanulas.
// Three states, as the prototype's PROTOTÍPUS row shows them: Tanul (learning on, rows exist),
// Még nincs adat (no reviewed week yet), Kikapcsolva (learning switched off, it still learns
// quietly). The data hooks are stubbed so every state is reachable in mock AND real mode; the
// six-section explainer is stubbed to a marker (it is tested on its own).
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExpenditureHistory, ExpenditureWeek, ExpenditureWeeklyCard } from '@/data/fuel/expenditureApi'

const hooks = vi.hoisted(() => ({
  history: null as ExpenditureHistory | null,
  historyPending: false,
  historyError: false,
  card: null as ExpenditureWeeklyCard | null,
}))

vi.mock('@/data/fuel/expenditureHooks', () => ({
  useExpenditureHistory: () => ({ data: hooks.history, isPending: hooks.historyPending, isError: hooks.historyError }),
  useExpenditureWeeklyCard: () => ({ card: hooks.card, isPending: false }),
  useIntakeDays: () => ({
    days: [{ date: '2026-09-23', kcal: 1180, status: 'suspicious', mark: null }],
    isPending: false,
  }),
  useIntakeDayMark: () => ({ setMark: vi.fn(), clearMark: vi.fn(), pending: false }),
  useDismissWeeklyCard: () => ({ dismiss: vi.fn() }),
}))
vi.mock('@/features/fuel/sheets/LearnedBaseExplainer', () => ({
  LearnedBaseExplainer: () => <div data-testid="six-sections" />,
}))

import { LearningPage } from '@/features/fuel/pages/LearningPage'

const wk = (weekStart: string, over: Partial<ExpenditureWeek> = {}): ExpenditureWeek => ({
  weekStart, status: 'updated', confidence: 'medium', formulaBaseKcal: 2400, posteriorBaseKcal: 2470,
  posteriorSdKcal: 148, appliedBaseKcal: 2480, stepKcal: 60, usableDays: 4, weighInDays: 4, ...over,
})
const WEEKS = [wk('2026-09-07', { appliedBaseKcal: 2440, stepKcal: -15 }), wk('2026-09-14', { appliedBaseKcal: 2420 }), wk('2026-09-21')]

const CARD: ExpenditureWeeklyCard = {
  weekStart: '2026-09-21', weekEnd: '2026-09-27', status: 'updated', confidence: 'medium',
  appliedBaseKcal: 2480, posteriorSdKcal: 148, stepKcal: 60, usableDays: 4, weighInDays: 4,
  minUsableDays: 4, minWeighInDays: 2, excludedDays: [],
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/fuel', '/fuel/tanulas']} initialIndex={1}>
      <Routes>
        <Route path="/fuel" element={<p>mai oldal</p>} />
        <Route path="/fuel/tanulas" element={<LearningPage />} />
        <Route path="/settings/fuel" element={<p>fuel beállítások</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  hooks.history = { learningEnabled: true, weeks: WEEKS }
  hooks.historyPending = false
  hooks.historyError = false
  hooks.card = null
})

describe('LearningPage', () => {
  it('Tanul: the learned base with σ̂, the formula aside, the chart, the days and the six sections', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: 'Hogy tanultam?' })).toBeInTheDocument()
    const hero = document.querySelector('.fln-hero') as HTMLElement
    expect(within(hero).getByText('Tanult alap')).toBeInTheDocument() // eyebrow
    expect(within(hero).getByText('2480')).toBeInTheDocument()
    expect(within(hero).getByText('Tanult alap · Közepesen biztos · ±150 kcal')).toBeInTheDocument()
    expect(within(hero).getByText('A képlet 2 400 kcal-t mondana.')).toBeInTheDocument()
    // no weekly summary → a plain line, not a button
    expect(within(hero).queryByRole('button')).toBeNull()
    expect(screen.getByText('Hétről hétre')).toBeInTheDocument()
    expect(screen.getByText('3 hét')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /A keret alapja hétről hétre/ })).toBeInTheDocument()
    expect(screen.getByText('Az utolsó 14 nap')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
    expect(screen.getByText('A legutóbbi hét részletei')).toBeInTheDocument()
    expect(screen.getByText('A legutóbbi hét részletei').nextSibling?.textContent).toBe('szept. 21–27.')
    expect(screen.getByTestId('six-sections')).toBeInTheDocument()
  })

  it('Tanul with a weekly summary: the status row is one full-width button that opens it', async () => {
    hooks.card = CARD
    renderPage()
    const btn = screen.getByRole('button', { name: /Tanult alap · Közepesen biztos · ±150 kcal — heti összegző megnyitása/ })
    expect(btn).toHaveTextContent('· heti összegző ›')
    expect(btn.querySelector('.fwl-dot')).not.toBeNull()
    await userEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'Alap 2 480 kcal' })).toBeInTheDocument()
  })

  it('Még nincs adat: the honest empty line, no chart, no six sections — the days still render', () => {
    hooks.history = { learningEnabled: true, weeks: [] }
    renderPage()
    expect(screen.getByText(/ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés\./)).toBeInTheDocument()
    expect(screen.getByText('Még nem tanultam')).toBeInTheDocument()
    expect(screen.queryByText('Hétről hétre')).toBeNull()
    expect(screen.queryByRole('img', { name: /A keret alapja hétről hétre/ })).toBeNull()
    expect(screen.queryByTestId('six-sections')).toBeNull()
    expect(screen.getByText('Az utolsó 14 nap')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('Kikapcsolva: the frame comes from the formula, and it says what it quietly learned', async () => {
    hooks.history = { learningEnabled: false, weeks: WEEKS }
    hooks.card = CARD
    renderPage()
    const hero = document.querySelector('.fln-hero') as HTMLElement
    expect(within(hero).getByText('Most nem használom')).toBeInTheDocument()
    expect(hero.querySelector('.fln-off')!.textContent).toBe('A keret a képletből jön · 2 400 kcal')
    expect(within(hero).getByText('Közben csendben tovább tanultam: 2 470 ± 150 kcal')).toBeInTheDocument()
    expect(within(hero).queryByText(/heti összegző/)).toBeNull()
    expect(screen.getByText('Hétről hétre')).toBeInTheDocument()
    await userEvent.click(within(hero).getByRole('button', { name: 'Bekapcsolás a Fuel beállításokban' }))
    expect(screen.getByText('fuel beállítások')).toBeInTheDocument()
  })

  it('the back button returns to where the page was opened from', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(screen.getByText('mai oldal')).toBeInTheDocument()
  })

  it('shows a quiet loading and error line instead of numbers while the history is not there', () => {
    hooks.history = null
    hooks.historyPending = true
    const { unmount } = render(<MemoryRouter><LearningPage /></MemoryRouter>)
    expect(screen.getByText('Betöltöm, hogyan tanultam…')).toBeInTheDocument()
    expect(document.querySelector('.fln-hero')).toBeNull()
    expect(screen.queryByText('Hétről hétre')).toBeNull()
    unmount()
    hooks.historyPending = false
    hooks.historyError = true
    render(<MemoryRouter><LearningPage /></MemoryRouter>)
    expect(screen.getByText('Most nem sikerült betölteni, hogyan tanultam.')).toBeInTheDocument()
  })
})
