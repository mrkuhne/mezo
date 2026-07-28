import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { TrainTodayPage } from '@/features/train/pages/TrainTodayPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { DAY_ORDER } from '@/data/train/train'
import { SNOOZE_KEY } from '@/features/train/logic/morningWindow'
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
  localStorage.removeItem(SNOOZE_KEY) // the morning-training card state must not leak between tests
})
afterEach(() => vi.unstubAllEnvs())

const renderView = () => render(<QueryWrapper><MemoryRouter><LevelUpProvider><TrainTodayPage /></LevelUpProvider></MemoryRouter></QueryWrapper>)

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
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
        openWorkout: null,
      }),
    ),
  )
  renderView()
  expect(await screen.findByRole('button', { name: /Indítsuk/ })).toBeInTheDocument()
  expect(screen.getAllByText('Pull Day').length).toBeGreaterThan(0)
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
        exercises: [{ id: 'e-1', name: 'Burpee', muscle: 'full', sets: 3, targetReps: '10-12', targetRIR: 2, type: 'compound' }],
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
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
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
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
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
        exercises: [{ id: 'e-1', name: 'Row', muscle: 'back', sets: 4, targetReps: '8-10', targetRIR: 1, type: 'compound' }],
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
    expect(await screen.findByRole('status')).toBeInTheDocument()
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
