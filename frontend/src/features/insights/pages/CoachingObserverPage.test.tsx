import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryWrapper } from '@/test/queryWrapper'
import { API_BASE } from '@/test/msw/handlers'
import { server } from '@/test/msw/server'
import { CoachingObserverPage } from '@/features/insights/pages/CoachingObserverPage'
import { mockCoachingDay } from '@/data/insights/coachingTraceMock'
import { addDays, localDateString } from '@/shared/lib/dates'

const renderPage = (entry = '/mezo/coaching/megfigyelo') =>
  render(<MemoryRouter initialEntries={[entry]}><CoachingObserverPage /></MemoryRouter>,
    { wrapper: QueryWrapper })

describe('CoachingObserverPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('renders EVERY rule, in the severity order the server sent — the order is the decision', () => {
    const { container } = renderPage()
    const day = mockCoachingDay(localDateString())
    const names = Array.from(container.querySelectorAll('.mzo-rule-nm')).map((n) => n.textContent)
    expect(names).toEqual(day.rules.map((r) => r.label))
  })

  test('all five screen states are on the page, none of them silently dropped', () => {
    renderPage()
    expect(screen.getAllByText('Jelzett').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rendben').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Nem mérhető').length).toBeGreaterThan(0)
    expect(screen.getByText('Pihenőn')).toBeInTheDocument()
    expect(screen.getByText('Nyertes')).toBeInTheDocument()
  })

  test('a rule opens onto its frozen numbers', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Alvásadósság/ }))
    // The mock's sole fact for this rule repeats its `reasonText` verbatim (the always-visible
    // evidence line), so scope to the expandable body — the thing this test actually verifies is
    // that opening the tile reveals the frozen numbers row, not just that the string exists.
    // Matches the CORRECTED copy: the leading figure is the window TOTAL, and the per-night rate
    // is a separate, derived clause. A regex that would still pass against "1,4 óra/éjszaka" is
    // exactly what let the pre-fix mislabel sit in the fixture unnoticed (bd mezo-btmc).
    expect(screen.getByText(/Alvásadósság: összesen 1,4 óra hiány/, { selector: '.mzp-evrow .vl' }))
      .toBeVisible()
    expect(screen.getByText(/átlagosan 0,2 óra\/éjszaka/, { selector: '.mzp-evrow .vl' }))
      .toBeVisible()
  })

  test('the day’s timeline lists what changed, with the local wall clock', () => {
    renderPage()
    expect(screen.getByText('A nap változásai')).toBeInTheDocument()
    expect(screen.getAllByText(/Késői evés/).length).toBeGreaterThan(0)
  })

  test('paging back asks for the previous day and stops at the floor', async () => {
    renderPage()
    const back = screen.getByRole('button', { name: 'Előző nap' })
    await userEvent.click(back)
    expect(screen.getByText('tegnap')).toBeInTheDocument()
    // Forward is live again once we have left today.
    expect(screen.getByRole('button', { name: 'Következő nap' })).toBeEnabled()
  })

  test('today cannot be paged forward — there is no tomorrow to explain', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Következő nap' })).toBeDisabled()
    expect(screen.getByText('ma')).toBeInTheDocument()
  })

  test('an empty ?d= does not crash the page — it clamps to today', () => {
    renderPage('/mezo/coaching/megfigyelo?d=')
    expect(screen.getByText('ma')).toBeInTheDocument()
  })

  test('a garbage ?d= does not crash the page — it clamps to today', () => {
    renderPage('/mezo/coaching/megfigyelo?d=abc')
    expect(screen.getByText('ma')).toBeInTheDocument()
  })

  test('a calendrically invalid ?d= (Feb 30) clamps to today rather than rolling over', () => {
    renderPage('/mezo/coaching/megfigyelo?d=2026-02-30')
    expect(screen.getByText('ma')).toBeInTheDocument()
  })

  test('paging back to the floor disables further back-paging but keeps forward live', async () => {
    renderPage()
    const back = screen.getByRole('button', { name: 'Előző nap' })
    for (let i = 0; i < 13; i++) {
      await userEvent.click(back)
    }
    expect(screen.getByRole('button', { name: 'Előző nap' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Következő nap' })).toBeEnabled()
  })
})

describe('CoachingObserverPage (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('an unresolved day shows no rule tiles at all — never 14 fabricated „Rendben"', () => {
    const { container } = renderPage()
    expect(container.querySelectorAll('.mzo-rule')).toHaveLength(0)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })

  test('a day with nothing flagged says so, and a day with no changes shows no timeline box', async () => {
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () =>
      HttpResponse.json({ date: localDateString(), rules: [], transitions: [] })))
    renderPage()
    await waitFor(() =>
      expect(screen.getByText('Ezen a napon még nem futott kiértékelés.')).toBeInTheDocument())
    expect(screen.queryByText('A nap változásai')).not.toBeInTheDocument()
  })

  test('a quiet PAST day never claims "ma" — the copy is day-neutral', async () => {
    const yesterday = addDays(localDateString(), -1)
    // A day where every rule ran and none of them flagged (split.total > 0, nothing raised or
    // suppressed) — the "quiet" branch, distinct from the "no evaluation ran yet" empty state.
    server.use(http.get(`${API_BASE}/api/companion/flags/trace`, () => HttpResponse.json({
      date: yesterday,
      rules: [{
        flagKey: 'acute_bad_day', label: 'Rossz nap', domain: 'recovery', rank: 1,
        outcome: 'clear', reasonText: 'Rendben.', facts: [],
      }],
      transitions: [],
    })))
    renderPage(`/mezo/coaching/megfigyelo?d=${yesterday}`)
    expect(screen.getByText('tegnap')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(/egy szabály sem jelzett — mind a 1 rendben\./)).toBeInTheDocument())
    expect(screen.queryByText(/^Ma /)).not.toBeInTheDocument()
  })
})
