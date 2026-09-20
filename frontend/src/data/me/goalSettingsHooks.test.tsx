import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ReactNode } from 'react'
import { useGoalSettings } from '@/data/me/goalSettingsHooks'
import { useGoal } from '@/data/me/goalHooks'
import { goalResponse } from '@/data/me/goals'
import { goalResponseToUpsert, goalApi } from '@/data/me/goalApi'
const mode = vi.hoisted(() => ({ mock: false }))
vi.mock('@/data/_client/mode', () => ({ isMockMode: () => mode.mock }))
const request = { ...goalResponseToUpsert(goalResponse), targetDate: '2027-01-07', targetWeightKg: 78 }
const remaining = { trajectory: 'cut', startDate: '2026-09-20', targetDate: '2027-01-07', startWeightKg: 84.2, targetWeightKg: 78 }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return { client, wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }
}
beforeEach(() => { vi.restoreAllMocks(); mode.mock = false })
test('checks both historical and remaining windows and saves full request', async () => {
  const preview = vi.spyOn(goalApi, 'feasibilityPreview').mockResolvedValue({ derivedRatePctPerWeek: .4, withinSafeBand: true, verdict: 'feasible' })
  const update = vi.spyOn(goalApi, 'update').mockResolvedValue({ ...goalResponse, targetDate: request.targetDate, targetWeightKg: request.targetWeightKg })
  const { wrapper } = setup()
  const { result } = renderHook(() => useGoalSettings(goalResponse, request, remaining), { wrapper })
  await waitFor(() => expect(result.current.preview).toHaveLength(2))
  expect(preview).toHaveBeenCalledWith(expect.objectContaining({ startDate: goalResponse.startDate, startWeightKg: goalResponse.startWeightKg }))
  expect(preview).toHaveBeenCalledWith(remaining)
  await act(async () => { await result.current.save(request) })
  expect(update).toHaveBeenCalledWith(goalResponse.id, request)
})
test('never supplies a fake successful preview on server failure', async () => {
  vi.spyOn(goalApi, 'feasibilityPreview').mockRejectedValue(new Error('offline'))
  const { wrapper } = setup()
  const { result } = renderHook(() => useGoalSettings(goalResponse, request, remaining), { wrapper })
  await waitFor(() => expect(result.current.previewError).toBe(true))
  expect(result.current.preview).toBeNull()
})
test('mock save remains visible to the canonical goal reader after remount', async () => {
  mode.mock = true
  const { wrapper } = setup()
  const editor = renderHook(() => useGoalSettings(goalResponse, request, remaining), { wrapper })
  await act(async () => { await editor.result.current.save(request) })
  editor.unmount()
  const reader = renderHook(() => useGoal(), { wrapper })
  expect(reader.result.current.goalResponse?.targetDate).toBe('2027-01-07')
  expect(reader.result.current.goalResponse?.targetWeightKg).toBe(78)
})

test('changing the target invalidates preview readiness and ignores a late old response', async () => {
  let resolveOld!: (value: { derivedRatePctPerWeek: number; withinSafeBand: boolean; verdict: 'feasible' }) => void
  const old = new Promise<{ derivedRatePctPerWeek: number; withinSafeBand: boolean; verdict: 'feasible' }>(resolve => { resolveOld = resolve })
  vi.spyOn(goalApi, 'feasibilityPreview').mockImplementation(body => body.targetWeightKg === 78 ? old : Promise.resolve({ derivedRatePctPerWeek: .8, withinSafeBand: true, verdict: 'feasible' }))
  const { wrapper } = setup()
  const { result, rerender } = renderHook(({ target }) => useGoalSettings(goalResponse, { ...request, targetWeightKg: target }, { ...remaining, targetWeightKg: target }), { wrapper, initialProps: { target: 78 } })
  expect(result.current.previewPending).toBe(true)
  rerender({ target: 77 })
  expect(result.current.preview).toBeNull()
  await waitFor(() => expect(result.current.preview?.[0].derivedRatePctPerWeek).toBe(.8))
  await act(async () => { resolveOld({ derivedRatePctPerWeek: .4, withinSafeBand: true, verdict: 'feasible' }); await old })
  expect(result.current.preview?.[0].derivedRatePctPerWeek).toBe(.8)
})
