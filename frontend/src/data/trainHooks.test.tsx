import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useTrain } from './hooks'
import { makeHookWrapper } from '@/test/queryWrapper'

// Real-mode block — mirrors sleepHooks.test.tsx (stubEnv, not vi.mock, so the
// same file is exercised in both `pnpm test` and `VITE_USE_MOCK=false pnpm test`).
beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
})
afterEach(() => {
  vi.unstubAllEnvs()
})

test('useTrain (real mode) fetches mesocycles, formats display dates, derives activeMeso', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.mesocycles.length).toBeGreaterThan(0))
  const active = result.current.activeMeso
  expect(active.title).toBe('Hypertrophy 04 · Tavasz')
  expect(active.startDate).toBe('Máj 1') // ISO 2026-05-01 -> HU display
  expect(active.volumePerMuscle?.chest.source.confidence).toBe(0.78)
})

test('useTrain (real mode) fetches sport sessions with computed HU date labels', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.sport.sessions.length).toBeGreaterThan(0))
  expect(result.current.sport.sessions[0].date).toBe('Máj 20 · Sze') // TRUE day-of-week
  expect(result.current.sport.sessions[0].notes).toBeNull()
})

test('useTrain (real mode) keeps static parts (workout, gymSchedule, exerciseLibrary)', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.workout.exercises.length).toBeGreaterThan(0)
  expect(result.current.exerciseLibrary.length).toBeGreaterThan(0)
})
