import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useToday } from '@/data/hooks'
import { today, user, workout, workoutPrediction, volleyballNote } from '@/data/today/today'
import { makeHookWrapper } from '@/test/queryWrapper'

afterEach(() => {
  vi.unstubAllEnvs()
})

const HU_WEEKDAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

test('useToday (mock) returns the byte-identical Phase-1 statics + demo copy', () => {
  vi.stubEnv('VITE_USE_MOCK', 'true')
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  expect(result.current.today).toBe(today)
  expect(result.current.user).toBe(user)
  expect(result.current.workout).toBe(workout)
  expect(result.current.workoutTime).toBe('17:00')
  expect(result.current.prediction).toBe(workoutPrediction)
  expect(result.current.volleyballNote).toBe(volleyballNote)
  expect(result.current.briefingDemo).toBe(false)
})

test('useToday (real) composes Train + the real date; demo copy is null', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const { result } = renderHook(() => useToday(), { wrapper: makeHookWrapper() })
  // Demo surfaces are hidden from the very first frame — never a fabricated flash.
  expect(result.current.prediction).toBeNull()
  expect(result.current.volleyballNote).toBeNull()
  expect(result.current.briefingDemo).toBe(true)
  // Header date is real from the first frame.
  expect(HU_WEEKDAYS).toContain(result.current.today.dayLabel)
  // Composition lands once the Train queries resolve (MSW fixtures).
  await waitFor(() => expect(result.current.workout?.title).toBe('Pull Day'))
  expect(result.current.today.workoutType).toBe('Pull Day')
  expect(result.current.user.weekInMeso).toBe(3) // meso fixture currentWeek
  expect(result.current.user.mesoLabel).toBe('Hypertrophy 04 · Tavasz')
  expect(result.current.today.mesoPhase).toBe('MAV') // phaseCurve[currentWeek-1]
  await waitFor(() => expect(result.current.volleyballSessions).toHaveLength(5)) // sport-schedule fixture
})
