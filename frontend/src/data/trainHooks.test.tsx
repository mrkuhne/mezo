import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { useTrain } from './hooks'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'

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

test('useTrain (real mode) keeps static exerciseLibrary catalog', async () => {
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  expect(result.current.exerciseLibrary.length).toBeGreaterThan(0)
})

test('useTrain (real mode) returns nulls (no static fallback) when the backend is empty', async () => {
  server.use(
    http.get(`${API_BASE}/api/train/mesocycles`, () => HttpResponse.json([])),
    http.get(`${API_BASE}/api/train/sport-sessions`, () => HttpResponse.json([])),
  )
  const { result } = renderHook(() => useTrain(), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.mesocycles).toEqual([]))
  expect(result.current.activeMeso).toBeNull()
  expect(result.current.workout).toBeNull()
  expect(result.current.gymSchedule).toBeNull()
  expect(result.current.sport.schedule).toBeNull()
  expect(result.current.sport.week).toBeNull()
  expect(result.current.sport.crossLoad).toBeNull()
  expect(result.current.sport.sessions).toEqual([])
})
