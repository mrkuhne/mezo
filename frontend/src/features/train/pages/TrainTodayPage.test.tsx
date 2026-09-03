import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Link, MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { TrainTodayPage } from '@/features/train/pages/TrainTodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { DAY_LABELS, DAY_ORDER } from '@/data/train/train'
import { snoozeKey } from '@/features/train/logic/morningWindow'
import { localDateString } from '@/shared/lib/dates'

// Weekly-row gym taps route straight to the session/review (direct-start flow,
// mezo-bxpg) via useNavigate; mock it so we can assert the exact target
// without a full route tree (idiom already used by GoalsPage.test.tsx).
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Asserts Phase-1 mock meso/gym data, so pin mock mode explicitly (the swapped
// useTrain hook reads useQuery, so a QueryClientProvider is required too).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  mockNavigate.mockReset()
  localStorage.removeItem(snoozeKey()) // the morning-training card state must not leak between tests
})
afterEach(() => vi.unstubAllEnvs())

const renderView = () => render(<QueryWrapper><MemoryRouter><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)

// Renders the live URL next to the page — the selection is derived from `?day=`,
// so the URL is the thing to assert on (mezo-9bbc final review, I3). A real
// react-router `<Link>` alongside it stands in for the `Mai` sub-nav entry, which
// drops the param WITHOUT remounting this route element.
function LocationProbe() {
  const loc = useLocation()
  return <span data-testid="loc">{`${loc.pathname}${loc.search}`}</span>
}
const renderAt = (entry: string) =>
  render(
    <QueryWrapper>
      <MemoryRouter initialEntries={[entry]}>
        <LevelUpProvider>
          <TrainTodayPage />
          <LocationProbe />
          <Link to="/train">Mai-fül</Link>
        </LevelUpProvider>
      </MemoryRouter>
    </QueryWrapper>,
  )
const currentUrl = () => screen.getByTestId('loc').textContent

// Today's sport/run card (`TodaySessionCard`) by its display title — the session
// time lives in the card's tag row, not in the title, so scope time asserts to
// the returned card (the weekly rows repeat both title and time) — mezo-lruy.
const findTodayCard = async (title: string) =>
  (await screen.findByText(title, { selector: '.todaycard-title' })).closest('.todaycard') as HTMLElement

test('today gym hero renders (the weekly list + load tiles + note now live on Heti)', () => {
  const { container } = renderView()
  // "Pull Day" is the gym hero's title (h2); the hero itself is unique via .trainhero.
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  expect(container.querySelector('.trainhero')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Indítsuk →' })).toBeInTheDocument()
})

// The one-day rework (mezo-9bbc) dropped the unconditional `+ Saját edzés`
// footer, leaving the CTA only on rest days — a day WITH scheduled sessions had
// no way to assemble a one-off workout for today (mezo-eahv).
test('a day with scheduled sessions still offers the Saját edzés CTA', () => {
  renderView()
  // mock today (Csü) carries the gym hero — the footer CTA must still be there
  expect(screen.getByRole('button', { name: 'Indítsuk →' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Saját edzés/ }))
  expect(screen.getByText('Mit nyomunk ma?')).toBeInTheDocument()
})

test('a non-today selection offers no Saját edzés CTA (today-only entry)', () => {
  render(
    <QueryWrapper><MemoryRouter initialEntries={['/train?day=1']}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>,
  )
  expect(screen.getByRole('heading', { name: 'Kedd' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Saját edzés/ })).not.toBeInTheDocument()
})

test('day strip: selecting another day swaps the rendered sessions, no refetch', async () => {
  renderView()
  // mock week: today is Csü (gym Pull Day). Kedd carries volleyball 17:00.
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('tab', { name: /Kedd/ }))
  expect(screen.getByRole('heading', { name: 'Kedd' })).toBeInTheDocument()
  expect(await screen.findByText('Volleyball', { selector: '.todaycard-title' })).toBeInTheDocument()
  // back to today
  fireEvent.click(screen.getByRole('button', { name: /Ma$/ }))
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
})

test('a non-today gym day renders a read-only-capable card with a direct-start CTA', async () => {
  renderView()
  // Sze (Wed) carries a not-yet-done gym slot in the mock week.
  fireEvent.click(screen.getByRole('tab', { name: /Szerda|Sze/ }))
  expect(await screen.findByText('Pull Day', { selector: '.todaycard-title' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Kezdjük el/ }))
  // Mock MesoDay fixtures carry no `id`, so gymDayTarget resolves the plain route.
  expect(mockNavigate).toHaveBeenCalledWith('/train/session')
})

test('the weekly list and load tiles moved to Heti — Mai renders neither', () => {
  const { container } = renderView()
  expect(container.querySelectorAll('.dayrow')).toHaveLength(0)
  expect(container.querySelectorAll('.loadtile')).toHaveLength(0)
  expect(screen.queryByText('Heti terv')).not.toBeInTheDocument()
  // the strip replaces them
  expect(container.querySelectorAll('.daychip')).toHaveLength(7)
})

test('?day= initialises the selection (drill-in from Heti)', () => {
  render(
    <QueryWrapper><MemoryRouter initialEntries={['/train?day=1']}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>,
  )
  expect(screen.getByRole('heading', { name: 'Kedd' })).toBeInTheDocument()
})

// ---- I3 (mezo-9bbc final review): the URL is the single source of truth ----
// The selection used to be seeded from `?day=` into state ONCE and never written
// back, so a chip tap left the URL stale (a reload snapped back to the drilled-in
// day) and `← Ma` cleared the state but not the query (a reload re-selected that
// day with no button left to escape it).

test('selecting a day writes ?day= to the URL, and ← Ma clears it again', () => {
  renderAt('/train')
  expect(currentUrl()).toBe('/train')
  fireEvent.click(screen.getByRole('tab', { name: /^Szombat ·/ }))
  expect(screen.getByRole('heading', { name: 'Szombat' })).toBeInTheDocument()
  expect(currentUrl()).toBe('/train?day=5')
  fireEvent.click(screen.getByRole('button', { name: /Ma$/ }))
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  expect(currentUrl()).toBe('/train')
})

test('dropping ?day= without a remount (the Mai sub-nav tap) snaps the page back to today', () => {
  renderAt('/train?day=5')
  expect(screen.getByRole('heading', { name: 'Szombat' })).toBeInTheDocument()
  // the same mounted element, only the query changes — the page must follow it
  fireEvent.click(screen.getByRole('link', { name: 'Mai-fül' }))
  expect(currentUrl()).toBe('/train')
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ma$/ })).not.toBeInTheDocument()
})

test('hostile ?day= values fall back to today and leave the URL alone', () => {
  for (const raw of ['', '7', '-1', '1.5', 'kedd']) {
    const view = renderAt(`/train?day=${raw}`)
    expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
    expect(currentUrl()).toBe(`/train?day=${raw}`)
    view.unmount()
  }
})

test('today-only blocks hide on a non-today selection', () => {
  renderView()
  fireEvent.click(screen.getByRole('tab', { name: /Szombat|Szo/ }))
  // the morning-training nudge is a today-only nudge
  expect(screen.queryByText(/Reggeli edzés/i)).not.toBeInTheDocument()
})

test('own page-header: Mai nap h1 + Napiv over-line', () => {
  renderView()
  expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  // today is Csü ⇒ "Edzés · Csütörtök · W3"
  expect(screen.getByText('Edzés · Csütörtök · W3')).toBeInTheDocument()
})

test('no volleyball session today (Csü) ⇒ today-volleyball block is absent', () => {
  renderView()
  // The today-volleyball CTA must not be present initially (no vb today).
  expect(screen.queryByRole('button', { name: /Logold a session-t/ })).not.toBeInTheDocument()
})

test('the Mezociklus card navigates to the overview (mezo-hi9m)', () => {
  renderView()
  fireEvent.click(screen.getByRole('button', { name: /Mezociklus áttekintő/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/mesocycles/meso-hyp-04/overview')
})

test('morning-training card lists the late gym slots and one-tap reschedules them', async () => {
  renderView()
  // mock gym slots Kedd/Csü 18:30 vs mock wake 06:45 -> window 07:45–12:45
  expect(screen.getByText(/Kedd 18:30 · Csü 18:30/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Áthelyezés a reggeli ablakba' }))
  // cache mutated (setQueryData) -> both slots at 07:45 -> nothing offending -> card gone.
  // waitFor: the RQ observer notification lands past the click's synchronous act flush
  // (the codebase's mock-setQueryData assertion idiom, cf. AddPantryItemSheet.test.tsx).
  await waitFor(() => expect(screen.queryByText(/Kedd 18:30/)).toBeNull())
})

// ---- C2 (mezo-9bbc final review): mock's flag-based "today" vs the date math ----
// Mock mode's "today" is a fixture flag on Csü (train.ts) while the date math reads
// the wall clock. Computing every card's state against the clock meant that on any
// real weekday but Thursday, the run card merged into today's row (`todayRuns`, which
// IS clock-derived) was labelled TERVEZETT/ELMARADT and lost its log CTA — a straight
// regression from pre-branch Mai, invisible only under the frozen visual clock.
test('mock mode: the flagged day IS today for the date math, so today\'s run card keeps its CTA', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  // Friday — NOT the fixture's Csü. (Friday's prescribed pyramid run is the one the
  // mock seed leaves unlogged in the active block's current week, so the card is in
  // its CTA state and the regression is observable.)
  vi.setSystemTime(new Date('2026-07-17T12:00:00'))
  try {
    renderView()
    expect(screen.getByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
    // Friday's prescribed run is merged into today's row by `todayRuns`
    const runCard = await findTodayCard('Piramis-intervallum')
    expect(within(runCard).getByText('MA')).toBeInTheDocument()
    expect(within(runCard).getByRole('button', { name: /Naplózd a futást/ })).toBeInTheDocument()
    expect(within(runCard).queryByText(/TERVEZETT|ELMARADT/)).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

// ---- C1 (mezo-9bbc final review): the mock sport log must honour req.date ----
// The mock mutation hardcoded today's date, so a Pótold on a past day appended a
// session dated TODAY: the past day kept its ELMARADT/Pótold and the wall-clock day
// wrongly flipped to MEGVAN. Clock pinned to Wednesday so the wrong landing day (Sze,
// which also carries a volleyball slot in the mock week) is deterministic.
test('mock mode: a retroactive Pótold lands on the selected day, not on today', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday
  try {
    renderAt('/train?day=1') // Kedd — volleyball 17:00, before the fixture's Csü "today"
    const before = await findTodayCard('Volleyball')
    expect(within(before).getByText('ELMARADT')).toBeInTheDocument()
    fireEvent.click(within(before).getByRole('button', { name: /Pótold/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
    // Kedd — the day it was logged FOR — flips to done
    await waitFor(() =>
      expect(within(screen.getByText('Volleyball', { selector: '.todaycard-title' }).closest('.todaycard') as HTMLElement)
        .getByText(/MEGVAN/)).toBeInTheDocument())
    // …and Szerda — the wall-clock day the old mock wrote to — does NOT
    fireEvent.click(screen.getByRole('tab', { name: /^Szerda ·/ }))
    const wed = await findTodayCard('Volleyball')
    expect(within(wed).queryByText(/MEGVAN/)).not.toBeInTheDocument()
    expect(within(wed).getByText('ELMARADT')).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('morning-training card snooze survives a remount for the same schedule+wake', () => {
  const first = renderView()
  fireEvent.click(screen.getByRole('button', { name: 'Maradjon így' }))
  expect(screen.queryByText(/Kedd 18:30/)).toBeNull()
  first.unmount()
  renderView()
  expect(screen.queryByText(/Kedd 18:30/)).toBeNull()
})

// ---- real-mode block: agenda derives from the active meso, /today drives the hero ----

const todayLabel = () => DAY_ORDER[(new Date().getDay() + 6) % 7]

function realMeso(dayLabel: string) {
  return {
    id: 'm-1', title: 'T2 meso', shortTitle: 'T2', status: 'active',
    startDate: '2026-06-01', endDate: '2026-07-13', weeks: 6, currentWeek: 2,
    split: 'Pull / Push · 2×/hét', style: 'RP · 6 hét', phaseCurve: ['MEV', 'MAV'],
    days: [{
      id: 'd-1', day: dayLabel, type: 'Pull Day', muscle: 'back', exerciseCount: 1,
      exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
    }],
  }
}

test('real mode renders the today card and agenda from the active meso + /today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(todayLabel())])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    // pin the schedule empty — the default BVSC fixture would add weekday-dependent vb rows
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        // Contract-shaped TodayExercise (WorkoutTodayResponse.exercises[], api.gen.ts):
        // workingSets/warmupSets/repMin/repMax — NOT the Phase-1 sets/targetReps pair
        // the mapper (toWorkoutPlan, trainHooks.ts) ignores.
        exercises: [{
          id: 'e-1', name: 'Row', muscle: 'back', type: 'compound',
          workingSets: 4, warmupSets: 2, repMin: 8, repMax: 10, targetRIR: 1,
        }],
        openWorkout: null,
      }),
    ),
  )
  renderView()
  expect(await screen.findByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
  // Hand-computed duration (sessionLength.ts estimateSessionMinutes) using the CALIBRATED
  // path — real mode resolves GET /api/train/timing-profile (default MSW handler, the same
  // static-seed values as the mock: 480/180/125/240) — never call the estimator here.
  // Single exercise: type=compound, workingSets=4, warmupSets=2.
  //   sets = workingSets + warmupSets = 6
  //   setCycles = max(0, sets - 1) * setCycleCompoundSeconds = 5 * 180 = 900
  //   transitions = max(0, exerciseCount - 1) * transitionSeconds = 0 (one exercise)
  //   total = leadInSeconds(480) + 900 + 0 = 1380 seconds = 23 minutes
  // The workoutMinutes render is gated on the profile query settling (no flash from static
  // to calibrated), so this must be awaited rather than asserted synchronously.
  expect(await screen.findByText('~23 perc')).toBeInTheDocument()
})

test('real mode shows the rest-day note when /today is empty but a meso is active', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    // the meso's only gym day is NOT today -> rest day
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderView()
  expect(await screen.findByText(/Ma pihenőnap/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Indítsuk/ })).not.toBeInTheDocument()
  // Zero-guard: an absent workout (`{}` — no exercises at all) must render no duration chip.
  expect(screen.queryByText(/~\d+ perc/)).not.toBeInTheDocument()
})

// Review fix (mezo-9bbc): a genuine rest day flags NO agenda row `isToday` at all
// (no gym/sport slot matches today), so `shownDay` is undefined even though today
// is shown by default — the DayStrip must still fall back to highlighting today's
// own chip instead of selecting none.
test('real mode: a rest day still highlights today\'s own DayStrip chip', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderView()
  await screen.findByText(/Ma pihenőnap/)
  // The chip's accessible name is `{weekday} · {day number}. · {done marker}`
  // (mezo-9bbc final review — the number + marker used to be announced to nobody),
  // so anchor on the weekday and assert the spoken rest marker too.
  const todayChip = screen.getByRole('tab', { name: new RegExp(`^${DAY_LABELS[todayLabel()]} ·`) })
  expect(todayChip).toHaveAttribute('aria-selected', 'true')
  expect(todayChip).toHaveAccessibleName(/· pihenő$/)
})

// An open custom (saját) instance on a rest day (no gym slot today) has no gym-hero
// home, so it needs its own resume affordance instead of just "Ma pihenőnap" with
// nothing to resume it (final-review fix, mezo-ws2x — Finding 4).
test('real mode: an open custom instance on a rest day renders a resume card, not just Ma pihenőnap', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    // the meso's only gym day is NOT today -> rest day (no gym schedule slot today)
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'cw-1', dayLabel: 'Ma', title: 'Saját HIIT', durationEst: 30,
        exercises: [{
          id: 'e-1', name: 'Burpee', muscle: 'full', type: 'compound',
          workingSets: 3, warmupSets: 1, repMin: 10, repMax: 12, targetRIR: 2,
        }],
        openWorkout: {
          id: 'w-9', templateSessionId: 'cw-1', date: localDateString(), status: 'active',
          sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 0, reps: 10, skipped: false }],
        },
      }),
    ),
  )
  renderView()
  expect(await screen.findByText('● Folyamatban')).toBeInTheDocument()
  expect(screen.getByText('Saját HIIT')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Folytassuk/ })).toBeInTheDocument()
  expect(screen.getByText(/Folytassuk → · 1 szett kész/)).toBeInTheDocument()
  expect(screen.queryByText(/Ma pihenőnap/)).not.toBeInTheDocument()
})

// ---- I2 (mezo-9bbc final review): "is today shown" must be DATE-based ----
// It used to read the agenda's `isToday` flag, which real mode only sets on a day
// carrying a gym/sport slot. Tapping today's own chip (or Heti's drill-in into
// today's row) therefore rendered today as "not today": the weekday name instead of
// „Mai nap”, a pointless „← Ma” chip, and — functionally — no `+ Saját edzés` CTA
// and no in-progress resume card, i.e. no way to start or resume a custom workout.
const restDayHandlers = () => [
  http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
  http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
  http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
]
const todayDrillIn = () => `/train?day=${(new Date().getDay() + 6) % 7}`

test('real mode: today\'s OWN chip on a rest day still reads as today (Mai nap + Saját edzés)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    ...restDayHandlers(),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderAt(todayDrillIn())
  expect(await screen.findByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ma$/ })).not.toBeInTheDocument()
  expect(screen.getByText(/Ma pihenőnap/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
})

test('real mode: today\'s OWN chip on a rest day keeps the in-progress resume card', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    ...restDayHandlers(),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'cw-1', dayLabel: 'Ma', title: 'Saját HIIT', durationEst: 30,
        exercises: [{
          id: 'e-1', name: 'Burpee', muscle: 'full', type: 'compound',
          workingSets: 3, warmupSets: 1, repMin: 10, repMax: 12, targetRIR: 2,
        }],
        openWorkout: {
          id: 'w-9', templateSessionId: 'cw-1', date: localDateString(), status: 'active',
          sets: [{ id: 's-1', exerciseId: 'e-1', setIndex: 0, weightKg: 0, reps: 10, skipped: false }],
        },
      }),
    ),
  )
  renderAt(todayDrillIn())
  expect(await screen.findByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  expect(screen.getByText('● Folyamatban')).toBeInTheDocument()
  expect(screen.getByText(/Folytassuk → · 1 szett kész/)).toBeInTheDocument()
})

test('real mode: today\'s OWN chip on a run-only day still reads as today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  server.use(
    ...restDayHandlers(),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([{
      id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
      startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
      structure: { weeks: [{
        weekNumber: 1, phaseLabel: 'Alapozás',
        sessions: [{
          key: 'today-sprint', dayOfWeek: todayIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
          kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
        }],
      }] },
    }])),
  )
  renderAt(todayDrillIn())
  expect(await screen.findByRole('heading', { name: 'Mai nap' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Ma$/ })).not.toBeInTheDocument()
  // and today's own run card keeps today's copy, not a retroactive Pótold
  expect(within(await findTodayCard('Reggeli sprint')).getByRole('button', { name: /Naplózd a futást/ })).toBeInTheDocument()
})

// ---- I6 (mezo-9bbc final review): completed custom workouts must reach Mai ----
// `daySessions` never emitted `custom`, so a day whose only session was a finished
// saját workout showed a dashed `pihenő` chip and „Nincs tervezett edzés” on Mai
// while Heti listed a SAJÁT/kész row that opened its review.
test('real mode: a completed custom (saját) workout renders its own card on Mai', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    ...restDayHandlers(),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/workouts`, () =>
      HttpResponse.json([
        { id: 'w-c1', templateSessionId: null, date: localDateString(), status: 'completed', origin: 'custom', title: 'Pihenőnapi felső' },
      ]),
    ),
  )
  renderView()
  const card = await findTodayCard('Pihenőnapi felső')
  // permanently-logged gym-tone card: SAJÁT · MEGVAN eyebrow, no state chip
  expect(within(card).getByText(/SAJÁT · MEGVAN/)).toBeInTheDocument()
  expect(card.className).toContain('todaycard-gym')
  expect(card.className).toContain('logged')
  // the day is no longer a rest day, and its strip chip stops claiming `pihenő`
  expect(screen.queryByText(/Ma pihenőnap/)).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: new RegExp(`^${DAY_LABELS[todayLabel()]} ·`) })).toHaveAccessibleName(/1\/1 kész$/)
  // the DoneBar opens the review, exactly like Heti's SAJÁT row
  fireEvent.click(within(card).getByRole('button', { name: /logolt session megnyitása/ }))
  expect(mockNavigate).toHaveBeenCalledWith('/train/review/w-c1')
})

test('real mode orders the morning run hero above the evening gym hero', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  const runBlock = {
    id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
    startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
    structure: {
      weeks: [{
        weekNumber: 1, phaseLabel: 'Alapozás',
        sessions: [{
          key: 'today-sprint', dayOfWeek: todayIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
          kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
        }],
      }],
    },
  }
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(todayLabel())])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    // gym slot today at 18:30 -> deriveGymSchedule fills the today gym day's time
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([{ id: 'g-1', dayOfWeek: todayIdx, time: '18:30' }])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([runBlock])),
    http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        exercises: [{
          id: 'e-1', name: 'Row', muscle: 'back', type: 'compound',
          workingSets: 4, warmupSets: 2, repMin: 8, repMax: 10, targetRIR: 1,
        }],
        openWorkout: null,
      }),
    ),
  )
  renderView()
  // both heroes present (K3: emoji lives in the icon shield now, the eyebrow tag is text-only —
  // scope to .typetag-run, since the weekly row's own .stag-run tag reads the same "FUTÁS").
  const runTag = await screen.findByText('FUTÁS', { selector: '.typetag-run' })
  const startBtn = await screen.findByRole('button', { name: 'Indítsuk →' }) // gym hero CTA
  // run hero (08:00) must precede gym hero (18:30) in the DOM
  expect(runTag.compareDocumentPosition(startBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

test('real mode renders the run hero (no rest-day note) when only a run is prescribed today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  // Running blocks are mesocycle-independent: the agenda's flag-based isToday is
  // never set by running, so a run-only-today (no gym day, no volleyball) must
  // still surface its hero and must NOT trigger the "Ma pihenőnap" rest card.
  const todayIdx = (new Date().getDay() + 6) % 7
  const runBlock = {
    id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
    startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
    structure: {
      weeks: [{
        weekNumber: 1, phaseLabel: 'Alapozás',
        sessions: [{
          key: 'today-sprint', dayOfWeek: todayIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
          kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
        }],
      }],
    },
  }
  server.use(
    // meso's only gym day is NOT today + no volleyball -> gym rest day
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([runBlock])),
    http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderView()
  // the run hero IS rendered (typetag + log CTA are hero-unique — scope to .typetag-run,
  // since the weekly row's own .stag-run tag reads the same "FUTÁS";
  // "Reggeli sprint" itself also appears in the weekly row, hence not asserted alone) ...
  expect(await screen.findByText('FUTÁS', { selector: '.typetag-run' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Naplózd a futást/ })).toBeInTheDocument()
  expect(screen.getAllByText('Reggeli sprint').length).toBeGreaterThan(0)
  // ... and the rest-day note is NOT (a prescribed run is not a rest day)
  expect(screen.queryByText(/Ma pihenőnap/)).not.toBeInTheDocument()
})

test('real mode shows the volleyball today-card when a slot falls on today', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-schedule`, () =>
      HttpResponse.json([
        { id: 'e1f3a0e2-0000-4000-8000-0000000000aa', dayOfWeek: todayIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      ]),
    ),
  )
  renderView()
  expect(within(await findTodayCard('Volleyball')).getByText('18:15')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Logold a session-t/ })).toBeInTheDocument()
  // gym rest day + vb today -> no rest-day card
  expect(screen.queryByText(/Ma pihenőnap/)).not.toBeInTheDocument()
})

test('real mode: volleyball logged today ⇒ hero flips to the done summary, not the log CTA', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-schedule`, () =>
      HttpResponse.json([
        { id: 'e1f3a0e2-0000-4000-8000-0000000000aa', dayOfWeek: todayIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      ]),
    ),
    // a session logged for TODAY (ISO date == today) — the hero must reflect it
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        { id: 'ss-today', sport: 'volleyball', date: localDateString(), time: '18:15', duration: 90, setsPlayed: 5, intensity: 7, rpe: 7, shoulderStrain: 6, jumpCount: null, notes: null },
      ]),
    ),
  )
  renderView()
  // K3: once logged, the eyebrow time is gone — the time only survives inside the
  // DoneBar's "18:15-kor logolva" detail line.
  expect(within(await findTodayCard('Volleyball')).getByText(/18:15/)).toBeInTheDocument()
  // done state: muted summary present, the "log it" CTA gone, the eyebrow reads "MEGVAN"
  expect(screen.getByText(/RPE 7 · 90p/)).toBeInTheDocument()
  expect(screen.getByText(/MEGVAN/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Logold a session-t/ })).not.toBeInTheDocument()
})

// Review fix (mezo-9bbc): today's logged session must not leak onto another day's
// card once that day is selected — a mixed-scheduling bug would have shown another
// day's volleyball card as already done (and hidden its CTA) just because TODAY's
// own session happened to be logged.
//
// The clock is pinned to a Wednesday so BOTH neighbours stay inside the same Mon–Sun
// agenda week and the past/future direction is deterministic (the earlier version
// picked `(dow + 1) % 7`, which is a PAST day whenever the suite runs on a Sunday —
// and then its `/Logold a session-t/` matcher silently missed the `Pótold` the
// retroactive-logging work shipped in this very branch, i.e. it passed by accident).
// Each direction is asserted explicitly: future ⇒ no CTA at all, past ⇒ Pótold.
test('real mode: a volleyball session logged today does not leak into another day\'s card', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday
  try {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const dow = (new Date().getDay() + 6) % 7 // 2 (Sze)
    const pastDow = dow - 1 // 1 (Kedd) — yesterday, same week
    const futureDow = dow + 1 // 3 (Csü) — tomorrow, same week
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
      http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
      // volleyball is scheduled on today AND on both neighbours this week
      http.get(`${API_BASE}/api/train/sport-schedule`, () =>
        HttpResponse.json([
          { id: 'sl-today', dayOfWeek: dow, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok' },
          { id: 'sl-past', dayOfWeek: pastDow, time: '17:00', durationMin: 90, kind: 'training', location: 'BVSC csarnok' },
          { id: 'sl-future', dayOfWeek: futureDow, time: '17:00', durationMin: 90, kind: 'training', location: 'BVSC csarnok' },
        ]),
      ),
      // a session logged for TODAY only
      http.get(`${API_BASE}/api/train/sport-sessions`, () =>
        HttpResponse.json([
          { id: 'ss-today', sport: 'volleyball', date: localDateString(), time: '18:15', duration: 90, setsPlayed: 5, intensity: 7, rpe: 7, shoulderStrain: 6, jumpCount: null, notes: null },
        ]),
      ),
    )
    renderView()
    // sanity check: today's own card IS logged (contrast for the assertions below)
    expect(await screen.findByText(/MEGVAN/)).toBeInTheDocument()

    // FUTURE day: not logged, and read-only — no CTA of any kind
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${DAY_LABELS[DAY_ORDER[futureDow]]} ·`) }))
    const future = await findTodayCard('Volleyball')
    expect(within(future).queryByText(/MEGVAN/)).not.toBeInTheDocument()
    expect(within(future).getByText('TERVEZETT')).toBeInTheDocument()
    expect(within(future).queryByRole('button', { name: /Logold a session-t|Pótold/ })).not.toBeInTheDocument()

    // PAST day: not logged either — but it DOES offer the retroactive Pótold (Task 9),
    // never today's own „Logold a session-t” copy.
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${DAY_LABELS[DAY_ORDER[pastDow]]} ·`) }))
    const past = await findTodayCard('Volleyball')
    expect(within(past).queryByText(/MEGVAN/)).not.toBeInTheDocument()
    expect(within(past).getByText('ELMARADT')).toBeInTheDocument()
    expect(within(past).getByRole('button', { name: /Pótold/ })).toBeInTheDocument()
    expect(within(past).queryByRole('button', { name: /Logold a session-t/ })).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

test('real mode: saving the volleyball log flips the hero to done (the reported bug)', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  // Stateful backend: GET reflects what POST persisted, so the invalidate→refetch
  // after save delivers the just-logged session — exactly the user's flow.
  const store: Array<Record<string, unknown>> = []
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
    http.get(`${API_BASE}/api/train/sport-schedule`, () =>
      HttpResponse.json([
        { id: 'e1f3a0e2-0000-4000-8000-0000000000aa', dayOfWeek: todayIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      ]),
    ),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json(store)),
    http.post(`${API_BASE}/api/train/sport-sessions`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>
      const created = { id: 'ss-new', sport: 'volleyball', date: localDateString(), time: '18:15', intensity: null, jumpCount: null, notes: null, ...body }
      store.push(created)
      return HttpResponse.json(created, { status: 201 })
    }),
  )
  renderView()
  // Initially the log CTA is shown (nothing logged today yet)
  fireEvent.click(await screen.findByRole('button', { name: /Logold a session-t/ }))
  // The sheet opens with sane defaults (90p / RPE 7); just save
  fireEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
  // After save the hero flips to the done summary and the log CTA is gone
  expect(await screen.findByText(/RPE 7 · 90p/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Logold a session-t/ })).not.toBeInTheDocument()
})

test('real mode: a completed today instance renders the Kész hero with Megnézem', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(todayLabel())])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        exercises: [{
          id: 'e-1', name: 'Row', muscle: 'back', type: 'compound',
          workingSets: 4, warmupSets: 2, repMin: 8, repMax: 10, targetRIR: 1,
        }],
        openWorkout: null,
        // a completed instance of today's day — the hero must show the Kész/Megnézem review CTA
        completedWorkout: {
          id: 'w-done', templateSessionId: 'd-1', date: localDateString(), status: 'completed',
          sets: [
            { id: 's1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 1, skipped: false },
            { id: 's2', exerciseId: 'e-1', setIndex: 1, weightKg: 100, reps: 8, rir: 1, skipped: false },
            { id: 's3', exerciseId: 'e-1', setIndex: 2, weightKg: 100, reps: 8, rir: 1, skipped: false },
          ],
        },
        weekDoneDates: [localDateString()],
      }),
    ),
  )
  renderView()
  // done-state hero: the shared DoneBar (3 non-skipped sets), no start CTA. The bar's
  // accessible name is its explicit ariaLabel, not its visible summary/detail text (mezo-9bbc).
  expect(await screen.findByRole('button', { name: 'Befejezett edzés áttekintése' })).toBeInTheDocument()
  expect(screen.getByText('Kész · 3 szett')).toBeInTheDocument()
  expect(screen.getByText('Megnézem az összegzést')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Indítsuk →' })).not.toBeInTheDocument()
})

test('real mode: an open instance renders the Folyamatban hero with Folytassuk', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(todayLabel())])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'd-1', dayLabel: todayLabel(), title: 'Pull Day', durationEst: 0,
        exercises: [{
          id: 'e-1', name: 'Row', muscle: 'back', type: 'compound',
          workingSets: 4, warmupSets: 2, repMin: 8, repMax: 10, targetRIR: 1,
        }],
        // an open (active, unfinished) instance with two logged sets — hero flips to in-progress
        openWorkout: {
          id: 'w-open', templateSessionId: 'd-1', date: localDateString(), status: 'active',
          sets: [
            { id: 's1', exerciseId: 'e-1', setIndex: 0, weightKg: 100, reps: 8, rir: 1, skipped: false },
            { id: 's2', exerciseId: 'e-1', setIndex: 1, weightKg: 100, reps: 8, rir: 1, skipped: false },
          ],
        },
      }),
    ),
  )
  renderView()
  expect(await screen.findByText('● Folyamatban')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Folytassuk/ })).toBeInTheDocument()
  expect(screen.getByText(/Folytassuk → · 2 szett kész/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Indítsuk →' })).not.toBeInTheDocument()
})

test('real mode: prescribed run logged today ⇒ run hero flips to the done summary, not the log CTA', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIdx = (new Date().getDay() + 6) % 7
  const runBlock = {
    id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
    startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
    structure: {
      weeks: [{
        weekNumber: 1, phaseLabel: 'Alapozás',
        sessions: [{
          key: 'today-sprint', dayOfWeek: todayIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
          kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
        }],
      }],
    },
  }
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([runBlock])),
    // the prescribed run is logged for this block/week/session — hero must reflect it
    http.get(`${API_BASE}/api/train/run-sessions`, () =>
      HttpResponse.json([
        { id: 'rl-1', blockId: 'rb-1', weekNumber: 1, sessionKey: 'today-sprint', date: localDateString(), completedRounds: 6, rpeActual: 9, hrRecoverySec: null, sprintLandmark: null, durationMin: 24, notes: null },
      ]),
    ),
    http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
  )
  renderView()
  // Scope to .typetag-run (the weekly row's own .stag-run chip reads the same plain
  // "FUTÁS"), and assert the logged eyebrow itself reads "FUTÁS · MEGVAN" — the same
  // guarantee the volleyball/TRX logged tests check via /MEGVAN/.
  expect(await screen.findByText(/MEGVAN/, { selector: '.typetag-run' })).toBeInTheDocument()
  // exact match: the weekly row's own fact pill also reads "RPE 9–10" (the prescribed
  // range), so an unanchored "RPE 9" substring would be ambiguous.
  expect(screen.getByText('RPE 9 · 6 kör')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Naplózd a futást/ })).not.toBeInTheDocument()
})

// Loading skeleton (mezo-f2z) — real mode shows the TrainTodaySkeleton (role="status")
// while the meso/today queries are unresolved (workoutPending); mock seeds → no skeleton.
describe('TrainTodayPage (real mode, pending)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())
  it('shows the skeleton while the meso + today queries are unresolved', async () => {
    // workoutPending = mesoPending || todayPending — both must never resolve.
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => new Promise(() => {})),
      http.get(`${API_BASE}/api/train/workouts/today`, () => new Promise(() => {})),
    )
    renderView()
    const status = await screen.findByRole('status')
    expect(status).toBeInTheDocument()
    // The skeleton must mirror the CURRENT Mai — a 7-chip DayStrip placeholder at the
    // real `.daychip` width — and NOT the five-row weekly timeline that moved to Heti,
    // otherwise the swap to content reflows, the one thing this skeleton exists to
    // prevent (mezo-9bbc final review, I4).
    const sk = Array.from(status.querySelectorAll('.sk')) as HTMLElement[]
    expect(sk.filter((el) => el.style.width === '62px')).toHaveLength(7)
    // the only remaining full-width block is the gym hero's CTA — 48px since the DS
    // re-skin gave it the minimum tap height (mezo-setx.6.2)
    expect(sk.filter((el) => el.style.width === '100%' && el.style.height === '48px')).toHaveLength(1)
  })
})

describe('TrainTodayPage (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())
  it('renders content with no skeleton (synchronous seed)', () => {
    renderView()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

test('real mode: a TRX slot renders its own hero, sport-matched done-state, and preselects the log sheet', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const dow = (new Date().getDay() + 6) % 7
  const otherDay = DAY_ORDER[(dow + 1) % 7]
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(otherDay)])),
    // A volleyball session logged TODAY must NOT mark the TRX slot done (date+sport matching).
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([
      { id: 'ss-1', sport: 'volleyball', date: localDateString(), time: '19:00', duration: 90, rpe: 7 },
    ])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-1', dayOfWeek: dow, time: '12:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
    ])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({ templateSessionId: null, dayLabel: todayLabel(), title: '', durationEst: 0, exercises: [], openWorkout: null })),
  )
  renderView()
  // TRX hero with its own tag + title, NOT done (the logged session is volleyball).
  // K3: the emoji lives in the icon shield, so the tag itself is text-only — scope
  // to .typetag-trx (title also reads "TRX", so an unscoped text match is ambiguous).
  expect(within(await findTodayCard('TRX')).getByText('12:00')).toBeInTheDocument()
  expect(screen.getByText('TRX', { selector: '.typetag-trx' })).toBeInTheDocument()
  const cta = screen.getByRole('button', { name: /Logold a session-t/ })
  // The log sheet opens preselected to TRX
  fireEvent.click(cta)
  expect(screen.getByText('Sport log · TRX')).toBeInTheDocument()
})

test('real mode: a TRX slot logged today shows the done hero (no váll segment) and re-opens the sheet', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const dow = (new Date().getDay() + 6) % 7
  const otherDay = DAY_ORDER[(dow + 1) % 7]
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso(otherDay)])),
    // A TRX session logged TODAY — non-volleyball, so no shoulderStrain field at all.
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([
      { id: 'ss-2', sport: 'trx', date: localDateString(), time: '12:00', duration: 60, rpe: 7 },
    ])),
    http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
      { id: 'sl-1', dayOfWeek: dow, time: '12:00', durationMin: 60, kind: 'training', sport: 'trx', location: 'Life1 Corvin' },
    ])),
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({ templateSessionId: null, dayLabel: todayLabel(), title: '', durationEst: 0, exercises: [], openWorkout: null })),
  )
  renderView()
  // TRX hero, done state: "MEGVAN" eyebrow, summary with no "váll" segment (volleyball-only).
  // K3: once logged the eyebrow time is gone — "12:00" only survives in the DoneBar detail.
  expect(within(await findTodayCard('TRX')).getByText(/12:00/)).toBeInTheDocument()
  expect(screen.getByText(/MEGVAN/)).toBeInTheDocument()
  const summary = screen.getByText(/RPE 7 · 60p$/)
  expect(summary).toBeInTheDocument()
  // Clicking the done summary re-opens the sheet, preselected to TRX. The DoneBar's
  // accessible name is its explicit ariaLabel (title + "logolt session megnyitása").
  fireEvent.click(screen.getByRole('button', { name: /logolt session megnyitása/ }))
  expect(screen.getByText('Sport log · TRX')).toBeInTheDocument()
})

// ---- Task 9 (mezo-9bbc): retroactive logging on past days ----
// The clock is pinned to a Wednesday (2026-07-15) so "yesterday" (Tue) and
// "tomorrow" (Thu) both land inside the SAME Mon–Sun agenda week regardless of
// the real calendar date the suite happens to run on — a Monday/Sunday "today"
// would otherwise wrap the computed past/future index into the adjacent week
// and assert the wrong branch. ONLY `Date` is faked (`toFake: ['Date']`) so
// MSW + RTL's findBy/waitFor polling keep running on real timers — the same
// idiom as FuelMaiPage.test.tsx's schedule-pinning tests.
test('a past unlogged sport slot offers Pótold and logs it on that day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday
  try {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const posted: Array<Record<string, unknown>> = []
    const todayIdx = (new Date().getDay() + 6) % 7 // 2 (Sze)
    const pastIdx = (todayIdx + 6) % 7 // 1 (Kedd) — yesterday, still this week
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
      http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
        { id: 'e1f3a0e2-0000-4000-8000-0000000000aa', dayOfWeek: pastIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      ])),
      http.post(`${API_BASE}/api/train/sport-sessions`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        return HttpResponse.json({ id: 'ss-new', sport: 'volleyball', ...body }, { status: 201 })
      }),
    )
    render(<QueryWrapper><MemoryRouter initialEntries={[`/train?day=${pastIdx}`]}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)
    expect(await screen.findByText('ELMARADT')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pótold/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
    await waitFor(() => expect(posted).toHaveLength(1))
    // the log carries the SELECTED day's date (Tue 2026-07-14), NOT today's (Wed 2026-07-15)
    expect(posted[0].date).toBe('2026-07-14')
    expect(posted[0].date).not.toBe(localDateString())
  } finally {
    vi.useRealTimers()
  }
})

test('a future slot renders no log CTA', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday
  try {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const todayIdx = (new Date().getDay() + 6) % 7 // 2 (Sze)
    const futureIdx = (todayIdx + 1) % 7 // 3 (Csü) — tomorrow, still this week
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
      http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([
        { id: 'e1f3a0e2-0000-4000-8000-0000000000bb', dayOfWeek: futureIdx, time: '18:15', durationMin: 90, kind: 'training', location: 'BVSC csarnok', intensityLabel: 'közepes' },
      ])),
    )
    render(<QueryWrapper><MemoryRouter initialEntries={[`/train?day=${futureIdx}`]}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)
    expect(await screen.findByText('TERVEZETT')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Logold|Pótold/ })).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

// Symmetric coverage for the running card — the same three-way rule and the same
// `date` threading, this time through RunLogSheet (RunSessionLogRequest.date is
// REQUIRED by the contract, unlike sport's server-side default).
test('a past unlogged run slot offers Pótold and logs it on that day', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-07-15T12:00:00')) // Wednesday
  try {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const posted: Array<Record<string, unknown>> = []
    const todayIdx = (new Date().getDay() + 6) % 7 // 2 (Sze)
    const pastIdx = (todayIdx + 6) % 7 // 1 (Kedd) — yesterday, still this week
    const runBlock = {
      id: 'rb-1', title: 'Robbanékonyság', goal: 'sprint', kind: 'interval', status: 'active',
      startDate: '2026-06-01', endDate: '2026-08-01', weeks: 4, currentWeek: 1, summary: null,
      structure: {
        weeks: [{
          weekNumber: 1, phaseLabel: 'Alapozás',
          sessions: [{
            key: 'past-sprint', dayOfWeek: pastIdx, timeOfDay: '08:00', label: 'Reggeli sprint',
            kind: 'sprint', rpeTarget: { min: 9, max: 10 }, rounds: 6, segments: [],
          }],
        }],
      },
    }
    server.use(
      http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([realMeso('NEMNAP')])),
      http.get(`${API_BASE}/api/train/workouts/today`, () => HttpResponse.json({})),
      http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/sport-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/gym-schedule`, () => HttpResponse.json([])),
      http.get(`${API_BASE}/api/train/running-blocks`, () => HttpResponse.json([runBlock])),
      http.get(`${API_BASE}/api/train/run-sessions`, () => HttpResponse.json([])),
      http.post(`${API_BASE}/api/train/run-sessions`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        posted.push(body)
        return HttpResponse.json({ id: 'rl-new', ...body }, { status: 201 })
      }),
    )
    render(<QueryWrapper><MemoryRouter initialEntries={[`/train?day=${pastIdx}`]}><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)
    expect(await screen.findByText('ELMARADT')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Pótold/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Mentés/ }))
    await waitFor(() => expect(posted).toHaveLength(1))
    // the log carries the SELECTED day's date (Tue 2026-07-14), NOT today's (Wed 2026-07-15)
    expect(posted[0].date).toBe('2026-07-14')
    expect(posted[0].date).not.toBe(localDateString())
  } finally {
    vi.useRealTimers()
  }
})

// Motion (mezo-d20.11): `/train/mai` had NO entrance choreography at all. The
// day body now rides the app's one-shot `.rise` cadence, re-armed on a DayStrip
// tap so a swapped day stages in instead of snapping.
test("the day body staggers inside an armed entrance group", async () => {
  const { container } = renderView()
  await screen.findByRole("heading", { name: "Mai nap" })
  const play = container.querySelector(".mz-play")
  expect(play).not.toBeNull()
  const risen = [...play!.querySelectorAll(".rise")] as HTMLElement[]
  expect(risen.length).toBeGreaterThan(1)
  // the Mezociklus nav row at 70ms, then the day s hero cards from 120ms
  expect(risen.some((el) => el.style.getPropertyValue("--d") === "70ms")).toBe(true)
  expect(risen.some((el) => el.style.getPropertyValue("--d") === "120ms")).toBe(true)
})
