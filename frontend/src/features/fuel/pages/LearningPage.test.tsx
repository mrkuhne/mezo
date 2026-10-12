// ============================================================
// Mezo · LearningPage tests (mezo-3n2so, spec §5.3) — „Hogy tanultam?” at /fuel/tanulas.
// Three states, as the prototype's PROTOTÍPUS row shows them: Tanul (learning on, rows exist),
// Még nincs adat (no reviewed week yet), Kikapcsolva (learning switched off, it still learns
// quietly). The data hooks are stubbed so every state is reachable in mock AND real mode; the
// six-step explainer is stubbed to a marker (it is tested on its own).
// Folyadék (mezo-n4wf5.5): the hero is the kit hero (label · the base in its ± band · verdict ·
// sub · the liquid action row), the sections are numbered cards; the title is the frame's.
// ============================================================
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExpenditureHistory, ExpenditureWeek, ExpenditureWeeklyCard, IntakeDayStatus } from '@/data/fuel/expenditureApi'
import { QueryWrapper } from '@/test/queryWrapper'
import { addDays, localDateString } from '@/shared/lib/dates'

const hooks = vi.hoisted(() => ({
  history: null as ExpenditureHistory | null,
  historyPending: false,
  historyError: false,
  card: null as ExpenditureWeeklyCard | null,
  days: [] as IntakeDayStatus[],
  ranges: [] as string[][],
  weightLog: [] as { date: string; value: number }[],
}))

vi.mock('@/data/hooks', () => ({ useWeight: () => ({ weightLog: hooks.weightLog }) }))
vi.mock('@/data/fuel/expenditureHooks', () => ({
  EXPENDITURE_HISTORY_KEY: ['expenditureHistory'],
  useExpenditureHistory: () => ({ data: hooks.history, isPending: hooks.historyPending, isError: hooks.historyError }),
  useExpenditureWeeklyCard: () => ({ card: hooks.card, isPending: false }),
  useIntakeDays: (from: string, to: string) => {
    hooks.ranges.push([from, to])
    return { days: hooks.days, isPending: false }
  },
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
    <QueryWrapper>
      <MemoryRouter initialEntries={['/fuel', '/fuel/tanulas']} initialIndex={1}>
        <Routes>
          <Route path="/fuel" element={<p>mai oldal</p>} />
          <Route path="/fuel/tanulas" element={<LearningPage />} />
          <Route path="/settings/fuel" element={<p>fuel beállítások</p>} />
          <Route path="/fuel/log/uj" element={<p>logolás</p>} />
        </Routes>
      </MemoryRouter>
    </QueryWrapper>,
  )
}

beforeEach(() => {
  hooks.history = { learningEnabled: true, weeks: WEEKS }
  hooks.historyPending = false
  hooks.historyError = false
  hooks.card = null
  hooks.days = [{ date: '2026-09-23', kcal: 1180, status: 'suspicious', mark: null }]
  hooks.ranges = []
  hooks.weightLog = []
})

const hero = () => document.querySelector('.fo-hero') as HTMLElement

describe('LearningPage', () => {
  it('Tanul: the learned base in its band with σ̂, the formula as the tick, the chart, the days and the six steps', () => {
    renderPage()
    const h = hero()
    expect(within(h).getByText('Tanult alap · Közepesen biztos · ±150 kcal')).toBeInTheDocument() // label
    expect(within(h).getByText('Ennyit égetsz edzés nélkül: 2 480 kcal.')).toBeInTheDocument() // verdict
    expect(within(h).getByText('A képlet 2 400 kcal-t mondana.')).toBeInTheDocument()
    const band = within(h).getByRole('img', { name: 'Tanult alap 2 480 kcal, ±150 kcal sávban; a képlet 2 400' })
    expect(band).toHaveTextContent('2 480 kcal')
    expect(band).toHaveTextContent('képlet 2 400')
    expect(band).toHaveTextContent('−150')
    // no weekly summary → no button, the hero closes on its plain liquid strip
    expect(within(h).queryByRole('button')).toBeNull()
    expect(h).toHaveAttribute('data-closed', 'true')
    expect(screen.getByRole('heading', { name: '1Hétről hétre · 3 hét' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /A keret alapja hétről hétre/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '2Az utolsó 14 nap' })).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '3A legutóbbi hét részletei' })).toBeInTheDocument()
    expect(screen.getByTestId('six-sections')).toBeInTheDocument()
    // the old skin is gone
    expect(document.querySelector('.fln-hero, .glass, .uv-halo, .fmx-page')).toBeNull()
  })

  it('a week that held says so under the verdict', () => {
    hooks.history = { learningEnabled: true, weeks: [...WEEKS.slice(0, 2), wk('2026-09-21', { status: 'holding', stepKcal: 0 })] }
    renderPage()
    expect(within(hero()).getByText('A képlet 2 400 kcal-t mondana. Ezen a héten vártam: kevés volt az adat, a keret nem változott.')).toBeInTheDocument()
  })

  it('Tanul with a weekly summary: the hero button (with its drop) opens it', async () => {
    hooks.card = CARD
    renderPage()
    const btn = within(hero()).getByRole('button', { name: 'Heti összegző · új heti tanulás' })
    expect(btn).toHaveTextContent('Heti összegző')
    expect(btn.querySelector('.ft-dot')).not.toBeNull()
    expect(btn.querySelector('.ft-dot.hold')).toBeNull()
    await userEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'Alap 2 480 kcal' })).toBeInTheDocument()
  })

  it('a held weekly summary draws the hollow drop', () => {
    hooks.card = { ...CARD, status: 'holding', stepKcal: 0 }
    renderPage()
    const btn = within(hero()).getByRole('button', { name: 'Heti összegző · ezen a héten vártam' })
    expect(btn.querySelector('.ft-dot.hold')).not.toBeNull()
  })

  it('Még nincs adat: the two conditions as levels, no chart, no six steps — the days still render', async () => {
    hooks.history = { learningEnabled: true, weeks: [] }
    const today = localDateString()
    hooks.days = [
      { date: addDays(today, -1), kcal: 1180, status: 'suspicious', mark: null },
      { date: addDays(today, -2), kcal: 2400, status: 'usable', mark: null },
      { date: addDays(today, -3), kcal: null, status: 'unlogged', mark: null },
    ]
    hooks.weightLog = [{ date: today, value: 82 }, { date: today, value: 82.1 }, { date: addDays(today, -20), value: 83 }]
    renderPage()
    const h = hero()
    expect(within(h).getByText('Még nem tanultam.')).toBeInTheDocument()
    expect(within(h).getByText('Ehhez legalább 10 felírt nap kell az utolsó 4 hétből és heti 2 mérlegelés.')).toBeInTheDocument()
    // logged days of the last 28 (existing read), and this week's weigh-in DAYS (two entries on one day = 1)
    expect(hooks.ranges).toContainEqual([addDays(today, -28), addDays(today, -1)])
    expect(within(h).getByText('Felírt nap az utolsó 4 hétben').parentElement).toHaveTextContent('2 / 10')
    expect(within(h).getByText('Mérlegelés ezen a héten').parentElement).toHaveTextContent('1 / 2')
    expect(screen.queryByText(/Hétről hétre/)).toBeNull()
    expect(screen.queryByRole('img', { name: /A keret alapja hétről hétre/ })).toBeNull()
    expect(screen.queryByTestId('six-sections')).toBeNull()
    expect(screen.getByRole('heading', { name: '1Az utolsó 14 nap' })).toBeInTheDocument()
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    await userEvent.click(within(h).getByRole('button', { name: 'Étkezés logolása' }))
    expect(screen.getByText('logolás')).toBeInTheDocument()
  })

  it('Kikapcsolva: the frame comes from the formula, and it says what it quietly learned', async () => {
    hooks.history = { learningEnabled: false, weeks: WEEKS }
    hooks.card = CARD
    renderPage()
    const h = hero()
    expect(within(h).getByText('Most nem használom')).toBeInTheDocument()
    expect(within(h).getByText('A keret a képletből jön: 2 400 kcal.')).toBeInTheDocument()
    expect(within(h).getByText('Közben csendben tovább tanultam: 2 470 ± 150 kcal.')).toBeInTheDocument()
    expect(within(h).getByRole('img', { name: /Tanult alap 2 470 kcal/ })).toBeInTheDocument()
    expect(within(h).queryByText(/Heti összegző/)).toBeNull()
    expect(screen.getByText(/Hétről hétre/)).toBeInTheDocument()
    await userEvent.click(within(h).getByRole('button', { name: 'Bekapcsolás a Fuel beállításokban' }))
    expect(screen.getByText('fuel beállítások')).toBeInTheDocument()
  })

  it('the back button returns to where the page was opened from', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: 'Vissza' }))
    expect(screen.getByText('mai oldal')).toBeInTheDocument()
  })

  it('loading and error faces: the empty level with the sentence, no numbers; the error offers a retry', async () => {
    hooks.history = null
    hooks.historyPending = true
    const { unmount } = render(<QueryWrapper><MemoryRouter><LearningPage /></MemoryRouter></QueryWrapper>)
    expect(within(hero()).getByText('Betöltöm, hogyan tanultam…')).toBeInTheDocument()
    expect(hero()).toHaveAttribute('role', 'status')
    expect(within(hero()).queryByRole('button')).toBeNull()
    expect(screen.queryByText(/Hétről hétre/)).toBeNull()
    expect(screen.queryByText('Az utolsó 14 nap')).toBeNull()
    unmount()
    hooks.historyPending = false
    hooks.historyError = true
    render(<QueryWrapper><MemoryRouter><LearningPage /></MemoryRouter></QueryWrapper>)
    expect(within(hero()).getByText('Most nem sikerült betölteni, hogyan tanultam.')).toBeInTheDocument()
    expect(hero()).toHaveAttribute('role', 'alert')
    await userEvent.click(within(hero()).getByRole('button', { name: 'Újrapróbálom' }))
  })
})
