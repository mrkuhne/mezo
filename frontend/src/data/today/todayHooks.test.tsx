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
  // Nothing finished on the default fixture → the day hero keeps its start CTA.
  expect(result.current.workoutDone).toBe(false)
  expect(result.current.workoutDoneSets).toBeNull()
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
})
