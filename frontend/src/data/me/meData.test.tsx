import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useProfile, useSleep } from '@/data/hooks'
import { useGoal } from '@/data/me/goalHooks'
import { useWeight } from '@/data/me/weightHooks'
import { QueryWrapper } from '@/test/queryWrapper'

// These assert the Phase-1 mock dataset, so pin mock mode explicitly — they must
// not depend on the ambient VITE_USE_MOCK default (e.g. `VITE_USE_MOCK=false pnpm test`).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('useProfile exposes only the user meta', () => {
  const { result } = renderHook(() => useProfile())
  // Shape guard: the Profil strip (mezo-lfw) cut useProfile down to just `user`;
  // catches a stray re-add of identityGoal/areas/quickSettings/version.
  expect(Object.keys(result.current)).toEqual(['user'])
  expect(result.current.user.name).toBe('Daniel')
})

test('useGoal returns the active cut goal + linked mesocycles', () => {
  const { result } = renderHook(() => useGoal(), { wrapper: QueryWrapper })
  expect(result.current.goal?.kind).toBe('cut')
  expect(result.current.goal?.currentWeight).toBe(78.6)
  expect(result.current.linkedMesocycles['meso-hyp-04'].status).toBe('active')
})

test('useWeight returns the log + trends', async () => {
  const { result } = renderHook(() => useWeight(), { wrapper: QueryWrapper })
  // mezo-idz2 appended a date-relative today row to weightLog (DayOrb mock parity) — 15 → 16.
  await waitFor(() => expect(result.current.weightLog.length).toBe(16))
  expect(result.current.weightTrends.last7d.weeklyRate).toBe(-0.5)
})

test('useSleep returns the log and last night', async () => {
  const { result } = renderHook(() => useSleep(), { wrapper: QueryWrapper })
  // mezo-idz2 appended a date-relative today row to sleepLog (DayOrb mock parity) — 14 → 15.
  await waitFor(() => expect(result.current.sleepLog.length).toBe(15))
  // The last seed night is now the mezo-idz2 today row (23:20→06:30, 7.1 h), which
  // supersedes the previous canonical screenshot night (mezo-fk9a, 00:42→09:03, 7.5 h).
  expect(result.current.lastNight.duration).toBe(7.1)
})
