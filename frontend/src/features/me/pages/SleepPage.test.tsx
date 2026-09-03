import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, expect, it, test, vi } from 'vitest'
import { SleepPage } from '@/features/me/pages/SleepPage'
import { QueryWrapper, makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

vi.mock('@/features/me/logic/sleepEscalation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/me/logic/sleepEscalation')>()),
  evaluateEscalation: vi.fn(() => ({ triggered: false, reason: null })),
}))
import { evaluateEscalation, snoozeKey } from '@/features/me/logic/sleepEscalation'

// Asserts the Phase-1 mock sleep hero, so pin mock mode explicitly. Also clears the
// snooze localStorage key and resets the escalation mock to its not-triggered default
// so test order can't leak state between the escalation cases.
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  localStorage.clear()
  vi.mocked(evaluateEscalation).mockReturnValue({ triggered: false, reason: null })
})
afterEach(() => vi.unstubAllEnvs())

// SleepPage renders a <Link> (night-mode entry row), so a router context is required.
const renderPage = () =>
  render(
    <MemoryRouter>
      <SleepPage />
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )

// ── entrance choreography (mezo-d20.11) ──
// Two blocks sat between the staggered siblings with no `.rise` at all
// (PhaseAverageCard, RemDurationCard) — a visible hole in the cascade.
test('the whole Alvás body is in the cascade — no un-risen block between the staggered ones', () => {
  const { container } = renderPage()
  const rises = [...container.querySelectorAll('.rise')]
  for (const r of rises) expect(r.closest('.mz-play')).not.toBeNull()
  const delays = rises
    .map((r) => (r as HTMLElement).style.getPropertyValue('--d'))
    .filter((d) => d !== '')
    .map((d) => Number.parseInt(d, 10))
  // 0 · 50 · 90 · 130 · 170 · 190 · 210 · 230 · 250 · 290 — a gapless ladder
  for (const wanted of [0, 50, 90, 130, 190, 210, 230, 250, 290]) {
    expect(delays).toContain(wanted)
  }
})

test('renders the last-night hero', () => {
  renderPage()
  // Mozaik PageHero (mezo-d20.6.4) renders the page name as a styled div, not an <h1> —
  // structural change from the old pghead-np face; the text is still the one assertion.
  expect(screen.getByText('Alvás')).toBeInTheDocument()
  expect(screen.getByText('Tegnap éjjel')).toBeInTheDocument()
  // hero duration (48px) renders "7.5" — also appears in the log, so assert it is present at least once
  expect(screen.getAllByText('7.5').length).toBeGreaterThan(0)
  // hero quality (32px) renders "9" — collides with other quality values, so assert presence
  expect(screen.getAllByText('9').length).toBeGreaterThan(0)
})

test('renders the recent log (last 7 nights, newest first)', () => {
  const { container } = renderPage()
  expect(container.querySelectorAll('[data-sleep-log-row]')).toHaveLength(7)
})

test('real mode with an empty sleep log renders the placeholder instead of crashing', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/biometrics/sleep`, () => HttpResponse.json([])))

  render(
    <MemoryRouter>
      <SleepPage />
    </MemoryRouter>,
    { wrapper: makeHookWrapper() },
  )

  await waitFor(() => expect(screen.getByText('Még nincs alvásadat.')).toBeInTheDocument())
})

it('renders the sleep-goal card with derived ends and the regularity band', () => {
  renderPage()
  // The bed-rail (mezo-d20.6.4) joins the emoji + time in ONE span per the prototype
  // (🛏️ {bed} / ☀️ {wake}), so the exact-string match moved to a substring regex.
  expect(screen.getByText(/🛏️\s*23:15/)).toBeInTheDocument()          // derived bed
  expect(screen.getAllByText(/☀️\s*06:45/).length).toBeGreaterThan(0) // fixed wake
  expect(screen.getByText('7.5 ó cél')).toBeInTheDocument()
  // The phrase now renders twice — the sleep-goal card's regularity quote (SleepPage.tsx) AND the
  // "A rendszeresség a király" education card title mounted since mezo-hd8k — so match like '06:45' above.
  expect(screen.getAllByText(/a rendszeresség a király/i).length).toBeGreaterThan(0)
  expect(screen.getByText('±15p')).toBeInTheDocument()
})

it('renders the two score rings with computed values', () => {
  renderPage()
  expect(screen.getByText('Rendszeresség')).toBeInTheDocument()
  expect(screen.getByText('Hatékonyság')).toBeInTheDocument()
  expect(screen.getByText('14 nap · ±15p')).toBeInTheDocument()
  expect(screen.getByText('cél ≥ 85%')).toBeInTheDocument()
})

it('opens the SleepGoalSheet from the szerkeszt button', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /szerkeszt/i }))
  expect(screen.getByRole('dialog', { name: 'Alvás-cél' })).toBeInTheDocument()
})

it('shows the bed-delta stat on the hero', () => {
  renderPage()
  // last mock night bed 00:42 vs target 23:15 -> +87p (wraps past midnight: 42 − 1395 + 1440)
  expect(screen.getByText(/vs\. cél lefekvés/)).toHaveTextContent('+87p')
})

test('renders the night-mode entry row linking to /me/sleep/night', () => {
  renderPage() // the file's existing helper
  const link = screen.getByRole('link', { name: /Éjszakai mód/ })
  expect(link).toHaveAttribute('href', '/me/sleep/night')
})

test('the back chip (Mozaik PageHead) navigates back', async () => {
  render(
    <MemoryRouter initialEntries={['/elsewhere', '/me/sleep']} initialIndex={1}>
      <Routes>
        <Route path="/elsewhere" element={<div>elsewhere-page</div>} />
        <Route path="/me/sleep" element={<SleepPage />} />
      </Routes>
    </MemoryRouter>,
    { wrapper: QueryWrapper },
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Vissza' }))
  expect(await screen.findByText('elsewhere-page')).toBeInTheDocument()
})

test('the header "＋ Log" action opens the real SleepLogSheet', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('button', { name: /Log/ }))
  expect(screen.getByText('Hogyan aludtunk?')).toBeInTheDocument()
})

test('renders the daily stat card when no escalation', () => {
  renderPage()
  expect(screen.getByText('Miért számít?')).toBeInTheDocument()
})

test('escalation replaces the stat card and Most nem snoozes it away', () => {
  vi.mocked(evaluateEscalation).mockReturnValue({ triggered: true, reason: 'short' })
  renderPage()
  expect(screen.getByText(/tartósan kevés/i)).toBeInTheDocument()
  expect(screen.queryByText('Miért számít?')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Most nem' }))
  expect(screen.getByText('Miért számít?')).toBeInTheDocument()
  expect(localStorage.getItem(snoozeKey())).not.toBeNull()
  vi.mocked(evaluateEscalation).mockReturnValue({ triggered: false, reason: null })
})

test('stat card opens the deck sheet', () => {
  renderPage()
  fireEvent.click(screen.getByText('Miért számít?'))
  expect(screen.getByText('A kutatás számai')).toBeInTheDocument()
})

it('renders the phase rail and both reference rows for a screenshot night', async () => {
  renderPage()
  // "Mély"/"REM" each label FOUR things: the hero's own rail legend item + reference row,
  // and PhaseAverageCard's rail legend item + reference row (mock seed clears its 3-night
  // floor) — two PhaseRail+PhaseReferenceRow pairs, not a stray duplicate. "REM" gets a
  // fifth hit from the phase-stacked SleepChart's own bottom legend (mezo-fk9a task 9);
  // that legend's other labels are lowercase ("mély"/"könnyű") so they don't collide with
  // the capitalized "Mély" query.
  expect((await screen.findAllByText('Mély')).length).toBe(4)
  expect(screen.getAllByText('REM').length).toBe(5)
  expect(screen.getAllByText(/ref \d+–\d+%/).length).toBe(4)
})

it('renders the phase-average card against the real mock seed (8 of 14 nights carry phases)', async () => {
  renderPage()
  expect(await screen.findByText('Átlagos összetétel · 8 éjszakából')).toBeInTheDocument()
})

it('renders the REM-duration card against the real mock seed (3 short / 5 long nights)', async () => {
  renderPage()
  // short avg rem (390,408,396min nights -> rem 112,112,110 = 111) vs long avg rem
  // (438,462,438,468,450min nights -> rem 140,148,138,152,144 = 144) -> delta 33.
  expect(await screen.findByText(/33 perccel/)).toBeInTheDocument()
})

test('renders the night-arc heading and card when the last night has a hypnogram', () => {
  renderPage() // mock lastNight (2026-05-22) carries a hypnogram
  expect(screen.getByText('Az éjszaka íve')).toBeInTheDocument()
})

test('omits the night-arc heading when the last night has no hypnogram (no stray heading over nothing)', async () => {
  // NightArcCard itself returns null without a valid hypnogram, but its Eyebrow heading is a
  // rendered sibling in SleepPage — this guards against the heading surviving alone.
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/biometrics/sleep`, () =>
      HttpResponse.json([
        { id: 's1', date: '2026-05-30', bedtime: '23:10', wakeup: '06:40', duration: 7.5, quality: 8, awakenings: 1, mealToSleep: 0, notes: null },
        { id: 's2', date: '2026-05-31', bedtime: '23:20', wakeup: '06:50', duration: 7.4, quality: 8, awakenings: 1, mealToSleep: 0, notes: null,
          inBedMin: 470, awakeMin: 24, lightMin: 204, remMin: 140, deepMin: 100, sourceQualityPct: 85, source: 'screenshot' },
      ]),
    ),
  )

  render(
    <MemoryRouter>
      <SleepPage />
    </MemoryRouter>,
    { wrapper: makeHookWrapper() },
  )

  await waitFor(() => expect(screen.getByText('Tegnap éjjel')).toBeInTheDocument())
  expect(screen.queryByText('Az éjszaka íve')).not.toBeInTheDocument()
})
