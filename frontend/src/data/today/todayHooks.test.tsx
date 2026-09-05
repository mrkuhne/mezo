import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useToday } from '@/data/hooks'
import { today, user, workoutPrediction, volleyballNote } from '@/data/today/today'
// `workout` is Train's own mock plan (mezo-oyhy.3: useToday's mock branch delegates to
// useTrain() for the recipe-shaped WorkoutPlan the session-length estimator needs — the
// old Today-local Phase-1 `Workout` duplicate is no longer read here).
import { workout as trainWorkoutMock } from '@/data/train/train'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { localDateString } from '@/shared/lib/dates'

afterEach(() => {
  vi.unstubAllEnvs()
})

const HU_WEEKDAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

test('useToday (mock) returns the statics + the train-mock workout + demo copy', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  expect(result.current.today).toBe(today)
  expect(result.current.user).toBe(user)
  expect(result.current.workout).toBe(trainWorkoutMock)
  expect(result.current.workoutTime).toBe('17:00')
  expect(result.current.prediction).toBe(workoutPrediction)
  expect(result.current.volleyballNote).toBe(volleyballNote)
})

test('useToday (real) composes Train + the real date; demo copy is null', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  // Demo surfaces are hidden from the very first frame — never a fabricated flash.
  expect(result.current.prediction).toBeNull()
  expect(result.current.volleyballNote).toBeNull()
  // Header date is real from the first frame.
  expect(HU_WEEKDAYS).toContain(result.current.today.dayLabel)
  // Composition lands once the Train queries resolve (MSW fixtures).
  await waitFor(() => expect(result.current.workout?.title).toBe('Pull Day'))
  expect(result.current.today.workoutType).toBe('Pull Day')
  expect(result.current.user.weekInMeso).toBe(3) // meso fixture currentWeek
  expect(result.current.user.mesoLabel).toBe('Hypertrophy 04 · Tavasz')
  expect(result.current.today.mesoPhase).toBe('MAV') // phaseCurve[currentWeek-1]
  await waitFor(() => expect(result.current.volleyballSessions).toHaveLength(5)) // sport-schedule fixture
  // Nothing finished or started on the default fixture → the day hero keeps its start CTA.
  expect(result.current.workoutDone).toBe(false)
  expect(result.current.workoutDoneSets).toBeNull()
  expect(result.current.workoutInProgress).toBe(false)
  expect(result.current.workoutOpenSets).toBeNull()
  expect(result.current.loggedSportKinds).toEqual([])
})

// mezo-v84m — the Ma tab used to hardcode `logged: false` for the gym hero, so a workout
// finished earlier today still read „Indítsuk". The done-state is the SAME server truth the
// Train tab's „Kész · N szett" hero reads (`/today`'s `completedWorkout`); Today just has to
// carry it. Skip markers are not sets, exactly as the Train hero counts them.
test('useToday (real) reports the day done once a completed instance exists', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(
    http.get(`${API_BASE}/api/train/workouts/today`, () =>
      HttpResponse.json({
        templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
        dayLabel: 'Csü',
        title: 'Pull Day',
        durationEst: 78,
        exercises: [],
        openWorkout: null,
        completedWorkout: {
          id: 'e1f3a0e2-0000-4000-8000-000000000020',
          templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
          date: '2026-06-12',
          status: 'completed',
          sets: [
            { id: 's1', exerciseId: 'x', setIndex: 0, skipped: false },
            { id: 's2', exerciseId: 'x', setIndex: 1, skipped: false },
            { id: 's3', exerciseId: 'y', setIndex: 0, skipped: true },
          ],
        },
      }),
    ),
  )
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.workoutDone).toBe(true))
  expect(result.current.workoutDoneSets).toBe(2)
})

test('useToday (mock) never claims the day is done — mock persists no instances', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  expect(result.current.workoutDone).toBe(false)
  expect(result.current.workoutDoneSets).toBeNull()
  expect(result.current.workoutInProgress).toBe(false)
  expect(result.current.workoutOpenSets).toBeNull()
  expect(result.current.loggedSportKinds).toEqual([])
})

// mezo-6kap — the second half of the same contradiction: an OPEN instance made the Ma hero
// read „Indítsuk" while the Train tab read „● Folyamatban · Folytassuk". Same source of truth
// (`/today`'s `openWorkout`), same precedence: a completed instance always wins over an open one.
const todayWith = (over: Record<string, unknown>) =>
  http.get(`${API_BASE}/api/train/workouts/today`, () =>
    HttpResponse.json({
      templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
      dayLabel: 'Csü', title: 'Pull Day', durationEst: 78, exercises: [],
      openWorkout: null, ...over,
    }),
  )

const instance = (status: 'active' | 'completed', sets: { skipped: boolean }[]) => ({
  id: 'e1f3a0e2-0000-4000-8000-000000000020',
  templateSessionId: 'a1f3a0e2-0000-4000-8000-000000000010',
  date: '2026-06-12',
  status,
  sets: sets.map((s, i) => ({ id: `s${i}`, exerciseId: 'x', setIndex: i, skipped: s.skipped })),
})

test('useToday (real) reports the day in progress while an open instance exists', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(todayWith({
    openWorkout: instance('active', [{ skipped: false }, { skipped: false }, { skipped: true }]),
  }))
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.workoutInProgress).toBe(true))
  expect(result.current.workoutOpenSets).toBe(2)
  // In progress is NOT done — the two states are mutually exclusive on the hero.
  expect(result.current.workoutDone).toBe(false)
})

test('useToday (real) lets a completed instance win over a lingering open one', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(todayWith({
    openWorkout: instance('active', [{ skipped: false }]),
    completedWorkout: instance('completed', [{ skipped: false }, { skipped: false }]),
  }))
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.workoutDone).toBe(true))
  expect(result.current.workoutInProgress).toBe(false)
  expect(result.current.workoutDoneSets).toBe(2)
})

// mezo-6kap — the sport hero had the same hardcoded `logged: false`. Its done-state is a logged
// SportSession on TODAY's date, matched by kind (a mixed day flips each hero independently).
// mezo-cq06 — a skip_sport_slot advice action hides one dated occurrence of a recurring sport
// slot; the Today hero's `volleyballSessions` used to keep rendering it regardless, contradicting
// the backend's own `hasScheduledTrainingOn`. Pin a Tuesday so the sport-schedule fixture's own
// Kedd 17:00 slot is deterministically "today" (dayOfWeek 1), instead of depending on the day the
// suite happens to run.
test('useToday (real) drops today\'s sport session once its dated occurrence is skipped', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-16T08:00:00')) // Tuesday
  try {
    server.use(
      http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
        HttpResponse.json([{ dayOfWeek: 1, time: '17:00', date: '2026-06-16' }]),
      ),
    )
    const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.volleyballSessions).toHaveLength(4)) // 5 fixture − the skipped Kedd slot
    expect(result.current.volleyballSessions.some((s) => s.day === 'Kedd')).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

test('useToday (real) keeps today\'s sport session when the skip targets a different date', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-06-16T08:00:00')) // Tuesday
  try {
    server.use(
      http.get(`${API_BASE}/api/train/sport-slot-skips`, () =>
        HttpResponse.json([{ dayOfWeek: 1, time: '17:00', date: '2026-06-23' }]), // next Tuesday, not today
      ),
    )
    const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.volleyballSessions).toHaveLength(5)) // full fixture, untouched
    expect(result.current.volleyballSessions.some((s) => s.day === 'Kedd' && s.today)).toBe(true)
  } finally {
    vi.useRealTimers()
  }
})

test('useToday (real) reports today\'s logged sport kinds', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const todayIso = localDateString(new Date())
  server.use(
    http.get(`${API_BASE}/api/train/sport-sessions`, () =>
      HttpResponse.json([
        // Today, two kinds — a mixed day.
        { id: 'a', sport: 'volleyball', date: todayIso, time: '18:00', duration: 90, rpe: 6.8 },
        { id: 'b', sport: 'trx', date: todayIso, time: '12:00', duration: 40, rpe: 5 },
        // Yesterday — must NOT leak into today's hero.
        { id: 'c', sport: 'cross', date: '2026-05-18', time: '10:00', duration: 60, rpe: 7 },
      ]),
    ),
  )
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.loggedSportKinds).toHaveLength(2))
  expect(result.current.loggedSportKinds).toEqual(expect.arrayContaining(['volleyball', 'trx']))
  expect(result.current.loggedSportKinds).not.toContain('cross')
})
