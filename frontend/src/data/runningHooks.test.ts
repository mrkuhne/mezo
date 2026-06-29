import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { createElement } from 'react'
import { useRunning } from './runningHooks'
import { runningApi } from '@/lib/runningApi'
import { newDraft } from './runningDraft'

// REAL mode: the create path must populate the blocks cache SYNCHRONOUSLY so the
// builder, navigated to immediately on success, finds the new block (mezo-11m).
beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: qc }, children)
  return { qc, wrapper }
}

test('real-mode create inserts the returned block into the cache on success', async () => {
  const created = { id: 'rb-new-1', status: 'planned', ...newDraft('2026-06-16', '2026-07-14'), goal: null, summary: null, currentWeek: 0 }
  vi.spyOn(runningApi, 'blocks').mockResolvedValue([])
  vi.spyOn(runningApi, 'create').mockResolvedValue(created as never)

  const { wrapper } = wrap()
  const { result } = renderHook(() => useRunning(), { wrapper })
  await waitFor(() => expect(result.current.runningPending).toBe(false))

  let got: { id: string } | undefined
  result.current.saveRunningBlock(null, newDraft('2026-06-16', '2026-07-14'), { onSuccess: (b) => { got = b } })

  await waitFor(() => expect(got?.id).toBe('rb-new-1'))
  // The cache already holds the block at the moment onSuccess runs (synchronous insert).
  await waitFor(() => expect(result.current.runningBlocks.find((b) => b.id === 'rb-new-1')).toBeDefined())
})

test('real-mode logRunSession forwards the levelUp on the log response', async () => {
  vi.spyOn(runningApi, 'blocks').mockResolvedValue([])
  vi.spyOn(runningApi, 'runSessions').mockResolvedValue([])
  vi.spyOn(runningApi, 'logRunSession').mockResolvedValue({
    id: 'rs-1', blockId: 'b1', weekNumber: 1, sessionKey: 'k', date: '2026-06-29',
    completedRounds: 6, rpeActual: 9, hrRecoverySec: 45, sprintLandmark: null, durationMin: null, notes: null,
    levelUp: { source: 'RUN', totalXp: 180, gains: [], levelUps: [], perks: [], robustness: { xpGained: 0, streakWeeks: 1 } },
  } as never)

  const { wrapper } = wrap()
  const { result } = renderHook(() => useRunning(), { wrapper })
  await waitFor(() => expect(result.current.runningPending).toBe(false))

  const seen: unknown[] = []
  result.current.logRunSession(
    { blockId: 'b1', weekNumber: 1, sessionKey: 'k', date: '2026-06-29', completedRounds: 6, rpeActual: 9, hrRecoverySec: 45, sprintLandmark: null, durationMin: null, notes: null },
    { onSuccess: (r) => seen.push(r?.levelUp) },
  )
  await waitFor(() => expect(seen).toHaveLength(1))
  expect((seen[0] as { source?: string })?.source).toBe('RUN')
})

test('real-mode logRunSession invalidates the progression profile cache', async () => {
  vi.spyOn(runningApi, 'blocks').mockResolvedValue([])
  vi.spyOn(runningApi, 'runSessions').mockResolvedValue([])
  vi.spyOn(runningApi, 'logRunSession').mockResolvedValue({
    id: 'rs-1', blockId: 'b1', weekNumber: 1, sessionKey: 'k', date: '2026-06-29',
    completedRounds: 6, rpeActual: 9, hrRecoverySec: 45, sprintLandmark: null, durationMin: null, notes: null,
  } as never)
  const { qc, wrapper } = wrap()
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const { result } = renderHook(() => useRunning(), { wrapper })
  await waitFor(() => expect(result.current.runningPending).toBe(false))
  result.current.logRunSession({ blockId: 'b1', weekNumber: 1, sessionKey: 'k', date: '2026-06-29', completedRounds: 6, rpeActual: 9, hrRecoverySec: 45, sprintLandmark: null, durationMin: null, notes: null })
  await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: ['progressionProfile'] }))
})

test('real-mode logRunSession calls onSettled even when the log POST fails (no stuck CTA)', async () => {
  vi.spyOn(runningApi, 'blocks').mockResolvedValue([])
  vi.spyOn(runningApi, 'runSessions').mockResolvedValue([])
  vi.spyOn(runningApi, 'logRunSession').mockRejectedValue(new Error('500'))

  const { wrapper } = wrap()
  const { result } = renderHook(() => useRunning(), { wrapper })
  await waitFor(() => expect(result.current.runningPending).toBe(false))

  const onSuccess = vi.fn()
  const onSettled = vi.fn()
  result.current.logRunSession(
    { blockId: 'b1', weekNumber: 1, sessionKey: 'k', date: '2026-06-29', completedRounds: 6, rpeActual: 9, hrRecoverySec: 45, sprintLandmark: null, durationMin: null, notes: null },
    { onSuccess, onSettled },
  )
  await waitFor(() => expect(onSettled).toHaveBeenCalledTimes(1))
  expect(onSuccess).not.toHaveBeenCalled()
})
