import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { useProfile, useSleep } from '@/data/hooks'
import { useGoal } from '@/data/me/goalHooks'
import { useWeight } from '@/data/me/weightHooks'
import { weightLog, weightTrends } from '@/data/me/goals'
import { sleepLog } from '@/data/me/sleep'
import { QueryWrapper } from '@/test/queryWrapper'

// These assert the Phase-1 mock dataset, so pin mock mode explicitly — they must
// not depend on the ambient VITE_USE_MOCK default (e.g. `VITE_USE_MOCK=false pnpm test`).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
afterEach(() => vi.unstubAllEnvs())

test('useProfile exposes only the user meta (mock mode)', () => {
  const { result } = renderHook(() => useProfile(), { wrapper: QueryWrapper })
  // Shape guard: the Profil strip (mezo-lfw) cut useProfile down to just `user`;
  // catches a stray re-add of identityGoal/areas/quickSettings/version.
  expect(Object.keys(result.current)).toEqual(['user'])
  expect(result.current.user?.name).toBe('Daniel')
})

test('useGoal returns the active cut goal + linked mesocycles', () => {
  const { result } = renderHook(() => useGoal(), { wrapper: QueryWrapper })
  expect(result.current.goal?.kind).toBe('cut')
  // mezo-7vdm #6: a currentWeight már a naplóból származik (korábban 78.6 literál volt,
  // miközben a legfrissebb sor 78.4 — három szám ugyanarról). A napló farka a fali órától
  // függ, ezért a seedhez mérünk, nem literálhoz.
  expect(result.current.goal?.currentWeight).toBe(weightLog[weightLog.length - 1].value)
  expect(result.current.linkedMesocycles['meso-hyp-04'].status).toBe('active')
})

test('useWeight returns the log + trends', async () => {
  const { result } = renderHook(() => useWeight(), { wrapper: QueryWrapper })
  // mezo-idz2 appended a date-relative today row; mezo-7vdm #6 then bridged the gap between
  // the fixed tail and today. A LITERAL count would now drift with the wall clock, so we
  // assert the seed's shape instead: the fixed rows are all there, plus a continuous run to
  // today. (`weightLog` itself is the subject — a count that depends on `new Date()` cannot
  // be a constant.)
  await waitFor(() => expect(result.current.weightLog.length).toBe(weightLog.length))
  expect(result.current.weightLog.length).toBeGreaterThanOrEqual(16)
  // Szintén származtatott (mezo-7vdm #6). A KONKRÉT szám a mai dátumtól függ, tehát a
  // seedhez mérünk; amit érdemben állítunk, az hogy a demó továbbra is FOGYÁST mutat —
  // egy laposra ült seed (0,0 kg/hét) csendben elrontaná a súly-felületeket.
  expect(result.current.weightTrends.last7d.weeklyRate).toBe(weightTrends.last7d.weeklyRate)
  expect(result.current.weightTrends.last7d.weeklyRate).toBeLessThan(0)
})

test('useSleep returns the log and last night', async () => {
  const { result } = renderHook(() => useSleep(), { wrapper: QueryWrapper })
  // Ugyanaz, mint a súlynál (mezo-7vdm #6): a hossz a fali órától függ, tehát a seedhez
  // mérünk, nem literálhoz.
  await waitFor(() => expect(result.current.sleepLog.length).toBe(sleepLog.length))
  expect(result.current.sleepLog.length).toBeGreaterThanOrEqual(15)
  // The last seed night is now the mezo-idz2 today row (23:20→06:30, 7.1 h), which
  // supersedes the previous canonical screenshot night (mezo-fk9a, 00:42→09:03, 7.5 h).
  expect(result.current.lastNight.duration).toBe(7.1)
})
