import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { EdzesHubPage } from '@/features/train/pages/EdzesHubPage'
import { LevelUpProvider } from '@/features/progression/LevelUpProvider'
import { ThemeProvider } from '@/app/ThemeProvider'
import { QueryWrapper } from '@/test/queryWrapper'
import { DAY_ORDER } from '@/data/train/train'
import { localDateString } from '@/shared/lib/dates'

// Edzés hub (mezo-d20.3.1) — the /train index's Mozaik face: one hero for today's
// session + the six-tile mosaic that replaced the nine sub-tabs. The behavioral
// contracts it inherits from TrainTodayPage are the spec: the three-state gym gating
// (done → resume → start), sport/run logging that only ever OPENS the log sheet
// (nothing self-completes — ADR 0010), a rest day that says so, and a meso-less day
// that ghosts with the wizard CTA instead of drawing a fabricated session.
//
// Data is stubbed at the hook boundary (the NapHubPage.test exemplar): the mock seeds
// and the real-mode MSW fixtures differ, and these assertions are about the FACE.
const TODAY = localDateString()
const TODAY_DAY = DAY_ORDER[(new Date().getDay() + 6) % 7]

type Slot = { day: string; active: boolean; today?: boolean; time: string | null; duration: number | null; type: string | null }
type SportSlot = { day: string; time: string; duration: number; court: string; intensity: string; role: string; sport?: 'volleyball' | 'cross' | 'trx'; today?: boolean }

const store = vi.hoisted(() => ({
  activeMeso: null as null | Record<string, unknown>,
  workout: null as null | Record<string, unknown>,
  gymTimes: [] as unknown[],
  sportSlots: [] as unknown[],
  sportSessions: [] as unknown[],
  gymDoneDates: [] as string[],
  todaySession: null as null | Record<string, unknown>,
  completedTodayWorkout: null as null | Record<string, unknown>,
  exerciseLibrary: [] as unknown[],
  exerciseRecords: [] as unknown[],
  runningBlock: null as null | Record<string, unknown>,
  runSessions: [] as unknown[],
  medals: [] as unknown[],
  niggle: true,
}))

const logSportSession = vi.fn()
const logRunSession = vi.fn()

vi.mock('@/data/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/data/hooks')>()
  return {
    ...actual,
    useTodayScenario: () => ({ dayState: 'normal', medCycleDay: 1, niggle: store.niggle, vulnerable: false, anchorMode: false }),
    useTrain: () => ({
      mesocycles: [], activeMeso: store.activeMeso, workout: store.workout,
      gymSchedule: { weeklyTimes: store.gymTimes }, gymSlots: [],
      sport: { schedule: { volleyball: { team: 'BVSC', sessions: store.sportSlots, season: '2026', weeklyHours: 4 } }, sessions: store.sportSessions, week: null, crossLoad: [] },
      exerciseLibrary: store.exerciseLibrary, exerciseRecords: store.exerciseRecords,
      todaySession: store.todaySession, completedTodayWorkout: store.completedTodayWorkout,
      gymDoneDates: store.gymDoneDates,
      workoutPending: false, sportPending: false, exercisesPending: false,
      sportEvents: [], logSportSession, mesoMutationPending: false,
    }),
    useRunning: () => ({
      runningBlocks: [], activeRunningBlock: store.runningBlock, runSessions: store.runSessions,
      runningPending: false, logRunSession, runningMutationPending: false,
    }),
    useWeekWorkouts: () => ({ workouts: [] }),
    useMedals: () => ({ data: store.medals, isPending: false }),
  }
})

const gymSlot = (over: Partial<Slot> = {}): Slot =>
  ({ day: TODAY_DAY, active: true, today: true, time: '07:30', duration: 60, type: 'Pull', ...over })

beforeEach(() => {
  store.activeMeso = { id: 'meso-1', shortTitle: 'Hypertrophy', currentWeek: 3, weeks: 5, phaseCurve: ['MEV', 'MEV', 'MAV', 'MAV', 'DEL'], days: [] }
  store.workout = { title: 'Pull A', tag: '', durationEst: 60, exercises: [], challenges: [] }
  store.gymTimes = [gymSlot()]
  store.sportSlots = []
  store.sportSessions = []
  store.gymDoneDates = []
  store.todaySession = null
  store.completedTodayWorkout = null
  store.exerciseLibrary = []
  store.exerciseRecords = []
  store.runningBlock = null
  store.runSessions = []
  store.medals = []
  store.niggle = true
  logSportSession.mockReset()
  logRunSession.mockReset()
})

function LocationProbe() {
  return <div data-testid="loc">{useLocation().pathname}</div>
}

function renderHub() {
  return render(
    <QueryWrapper>
      <ThemeProvider>
        <MemoryRouter initialEntries={['/train']}>
          <LevelUpProvider>
            <Routes>
              <Route path="/train" element={<EdzesHubPage />} />
              <Route path="*" element={null} />
            </Routes>
            <LocationProbe />
          </LevelUpProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryWrapper>,
  )
}

test('the hero carries today session, the meso position and the start CTA', async () => {
  renderHub()
  expect(await screen.findByText('Pull A')).toBeInTheDocument()
  expect(screen.getByText(/MA · 07:30 · Meso W3\/5/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Indítsuk →' }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/session')
})

test('an open instance resumes instead of restarting (the three-state gating)', async () => {
  store.todaySession = { templateSessionId: 't1', openWorkout: { id: 'w1', sets: [{ skipped: false }, { skipped: false }, { skipped: true }] } }
  renderHub()
  const cta = await screen.findByRole('button', { name: /Folytassuk/ })
  expect(cta).toHaveTextContent('Folytassuk → · 2 szett kész')
  expect(screen.queryByRole('button', { name: 'Indítsuk →' })).not.toBeInTheDocument()
})

test('a completed session wins: the done bar opens the review, no restart', async () => {
  store.completedTodayWorkout = { id: 'w9', sets: [{ skipped: false }, { skipped: false }] }
  store.todaySession = { templateSessionId: 't1', openWorkout: null }
  renderHub()
  const bar = await screen.findByRole('button', { name: 'Befejezett edzés áttekintése' })
  expect(bar).toHaveTextContent('Kész · 2 szett')
  expect(screen.queryByRole('button', { name: 'Indítsuk →' })).not.toBeInTheDocument()
  await userEvent.click(bar)
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/review/w9')
})

test('the coach line speaks the day plan niggle warning — and vanishes without one', async () => {
  store.workout = {
    title: 'Pull A', tag: '', durationEst: 60, exercises: [], challenges: [],
    niggleWarning: { muscle: 'shoulder', muscleLabel: 'Jobb váll', detail: 'Melegíts rá külön.' },
  }
  const { unmount } = renderHub()
  expect(await screen.findByText(/Jobb váll · Melegíts rá külön\./)).toBeInTheDocument()
  unmount()
  store.workout = { title: 'Pull A', tag: '', durationEst: 60, exercises: [], challenges: [] }
  renderHub()
  expect(await screen.findByText('Pull A')).toBeInTheDocument()
  expect(document.querySelector('.eh-coach')).toBeNull()
})

test('a sport-only day heroes the sport session and opens the log sheet (nothing self-completes)', async () => {
  store.gymTimes = []
  store.sportSlots = [{ day: TODAY_DAY, time: '18:00', duration: 90, court: 'BVSC', intensity: 'közepes', role: 'feladó', sport: 'trx', today: true } satisfies SportSlot]
  renderHub()
  expect(await screen.findByText('TRX')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Logold a session-t' }))
  expect(await screen.findByText(/RPE/)).toBeInTheDocument()
  expect(logSportSession).not.toHaveBeenCalled()
})

test('a rest day says so and keeps the Saját edzés escape hatch', async () => {
  store.gymTimes = []
  renderHub()
  expect(await screen.findByText('Pihenőnap')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saját edzés/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Indítsuk →' })).not.toBeInTheDocument()
})

test('with no active meso the hero ghosts with the wizard CTA — no fabricated session', async () => {
  store.activeMeso = null
  store.workout = null
  store.gymTimes = []
  renderHub()
  expect(await screen.findByText(/Itt fog élni a mai edzésed/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /Tervezz mesociklust/ }))
  expect(screen.getByTestId('loc')).toHaveTextContent('/train/mesocycles/new')
})

test('the mosaic carries the six tiles and each opens its own page', async () => {
  renderHub()
  const TILES: [string, string][] = [
    ['Heti terv', '/train/week'],
    ['Mesociklus', '/train/mesocycles'],
    ['Sport', '/train/sport'],
    ['Futás', '/train/futas'],
    ['Gyakorlatok', '/train/exercises'],
    ['Medálok', '/train/medals'],
  ]
  for (const [label] of TILES) expect(await screen.findByRole('button', { name: label })).toBeInTheDocument()
  cleanup()
  // one mount per tile: navigating away unmounts the hub with it
  for (const [label, path] of TILES) {
    renderHub()
    await userEvent.click(await screen.findByRole('button', { name: label }))
    expect(screen.getByTestId('loc')).toHaveTextContent(path)
    cleanup()
  }
})

test('tile bottom lines come from the pages own hooks', async () => {
  store.gymTimes = [gymSlot(), gymSlot({ day: DAY_ORDER[(DAY_ORDER.indexOf(TODAY_DAY as never) + 1) % 7], today: false })]
  store.gymDoneDates = [TODAY]
  store.exerciseLibrary = Array.from({ length: 161 }, (_, i) => ({ id: `e${i}` }))
  store.exerciseRecords = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}` }))
  store.medals = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}` }))
  renderHub()
  expect(await screen.findByRole('button', { name: 'Heti terv' })).toHaveTextContent('1 kész · 2 tervből')
  expect(screen.getByRole('button', { name: 'Mesociklus' })).toHaveTextContent('W3/5')
  expect(screen.getByRole('button', { name: 'Gyakorlatok' })).toHaveTextContent('161 · 9 rekord')
  expect(screen.getByRole('button', { name: 'Medálok' })).toHaveTextContent('12')
})

test('a tile whose source has nothing to say carries no fabricated line', async () => {
  store.gymTimes = []
  store.medals = []
  renderHub()
  const medals = await screen.findByRole('button', { name: 'Medálok' })
  expect(medals.querySelector('.eh-tbig')).toBeNull()
  const futas = screen.getByRole('button', { name: 'Futás' })
  expect(futas.querySelector('.mz-tile-line')).toBeNull()
  const heti = screen.getByRole('button', { name: 'Heti terv' })
  expect(heti.querySelector('.mz-tile-line')).toBeNull()
})
