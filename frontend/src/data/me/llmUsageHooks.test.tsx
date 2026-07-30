import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useLlmUsageSummary, LLM_USAGE_MOCK, LLM_USAGE_EMPTY } from '@/data/me/llmUsageHooks'

afterEach(() => vi.unstubAllEnvs())

describe('useLlmUsageSummary (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the demo seed synchronously (no loading frame)', () => {
    const { result } = renderHook(() => useLlmUsageSummary(), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual(LLM_USAGE_MOCK)
    expect(result.current.data.day.callCount).toBe(12)
    expect(result.current.data.month.costUsd).toBe(1.22)
  })
})

describe('useLlmUsageSummary (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('starts from the honest empty, then GETs /api/llm-usage/summary', async () => {
    let hit = 0
    server.use(
      http.get(`${API_BASE}/api/llm-usage/summary`, () => {
        hit += 1
        return HttpResponse.json({
          day: { callCount: 3, costUsd: 0.01, currency: 'USD' },
          week: { callCount: 20, costUsd: 0.09, currency: 'USD' },
          month: { callCount: 44, costUsd: null, currency: 'USD' },
        })
      }),
    )
    const { result } = renderHook(() => useLlmUsageSummary(), { wrapper: makeHookWrapper() })
    // Never the mock seed while unresolved (the dual-mode invariant).
    expect(result.current.data).toEqual(LLM_USAGE_EMPTY)
    await waitFor(() => expect(result.current.data.day.callCount).toBe(3))
    expect(hit).toBe(1) // the hook hit the contract URL, not some other path
    expect(result.current.data.week.costUsd).toBe(0.09)
    expect(result.current.data.month.costUsd).toBeNull()
  })
})
