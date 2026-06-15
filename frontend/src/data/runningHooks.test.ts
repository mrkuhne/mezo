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
