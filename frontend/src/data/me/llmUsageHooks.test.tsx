import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import {
  useLlmUsageSummary,
  LLM_USAGE_MOCK,
  LLM_USAGE_EMPTY,
  useLlmUsageBreakdown,
  LLM_BREAKDOWN_MOCK,
  LLM_BREAKDOWN_EMPTY,
  useLlmCalls,
  LLM_CALLS_MOCK,
  LLM_CALLS_EMPTY,
  useLlmCall,
  LLM_CALL_DETAIL_MOCK,
  LLM_CALL_DETAIL_EMPTY,
} from '@/data/me/llmUsageHooks'

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

describe('useLlmUsageBreakdown (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the demo rollup synchronously (no loading frame)', () => {
    const { result } = renderHook(() => useLlmUsageBreakdown('DAY'), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual(LLM_BREAKDOWN_MOCK)
    expect(result.current.data.totals.callCount).toBe(412)
  })

  it('keeps the seed reconcilable: both rollups sum to the totals, errors in a null-model bucket', () => {
    // The response is exhaustive, so a rollup the real endpoint could never produce would teach
    // the reader (and every mock-mode screenshot) something false. An ERROR row has no served
    // model, so those rows MUST show up as the null-keyed group — the one the UI renders as
    // "ismeretlen" with a dashed cost.
    const { totals, features, models } = LLM_BREAKDOWN_MOCK
    const calls = (groups: typeof models) => groups.reduce((n, g) => n + g.callCount, 0)
    const cost = (groups: typeof models) => groups.reduce((n, g) => n + (g.costUsd ?? 0), 0)

    expect(calls(features)).toBe(totals.callCount)
    expect(calls(models)).toBe(totals.callCount)
    expect(cost(features)).toBeCloseTo(totals.costUsd ?? 0, 6)
    expect(cost(models)).toBeCloseTo(totals.costUsd ?? 0, 6)
    expect(models.find((m) => m.key == null))
      .toEqual({ key: null, callCount: totals.errorCount, costUsd: null })
  })

  it('keeps byUser reconcilable too: the per-account groups sum to the totals, background is the null group', () => {
    const { totals, byUser } = LLM_BREAKDOWN_MOCK
    expect(byUser.reduce((n, g) => n + g.callCount, 0)).toBe(totals.callCount)
    expect(byUser.reduce((n, g) => n + (g.costUsd ?? 0), 0)).toBeCloseTo(totals.costUsd ?? 0, 6)
    expect(byUser.find((g) => g.userId == null)?.name).toBeNull()
  })
})

describe('useLlmUsageBreakdown (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns the honest empty (never the seed) while unresolved, then the fetched rollup', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/breakdown`, () =>
        HttpResponse.json({
          from: '2026-08-14',
          totals: { callCount: 3, successCount: 3, errorCount: 0, cancelledCount: 0, unpricedCount: 1, costUsd: 0.5, currency: 'USD' },
          features: [{ key: 'companion_chat', callCount: 3, costUsd: 0.5 }],
          models: [{ key: 'gemini-2.5-flash', callCount: 3, costUsd: 0.5 }],
          byUser: [],
        }),
      ),
    )

    const { result } = renderHook(() => useLlmUsageBreakdown('DAY'), { wrapper: makeHookWrapper() })

    // the unresolved window must NOT show the mock seed
    expect(result.current.data).toEqual(LLM_BREAKDOWN_EMPTY)
    await waitFor(() => expect(result.current.data.totals.callCount).toBe(3))
    expect(result.current.data.features[0].key).toBe('companion_chat')
  })
})

describe('useLlmCalls (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the demo call list synchronously (no loading frame)', () => {
    const { result } = renderHook(() => useLlmCalls('DAY', {}, 50), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual(LLM_CALLS_MOCK)
    expect(result.current.data.items).toHaveLength(7)
    // the opening window covers the whole seed — nothing more to offer
    expect(result.current.data.hasMore).toBe(false)
  })

  it('answers the filters like the server does, instead of returning the seed verbatim', () => {
    const wrapper = makeHookWrapper()

    const byFeature = renderHook(() => useLlmCalls('DAY', { feature: 'meal_draft' }, 50), { wrapper })
    expect(byFeature.result.current.data.items.map((i) => i.feature)).toEqual(['meal_draft'])

    const byStatus = renderHook(() => useLlmCalls('DAY', { status: 'CANCELLED' }, 50), { wrapper })
    expect(byStatus.result.current.data.items.map((i) => i.status)).toEqual(['CANCELLED'])

    const byKind = renderHook(() => useLlmCalls('DAY', { callKind: 'EMBED_DOC' }, 50), { wrapper })
    expect(byKind.result.current.data.items.map((i) => i.callKind)).toEqual(['EMBED_DOC'])

    // the axes combine, and a narrowing with no match is an honest empty list
    const combined = renderHook(
      () => useLlmCalls('DAY', { feature: 'meal_draft', status: 'SUCCESS' }, 50),
      { wrapper },
    )
    expect(combined.result.current.data.items).toEqual([])
  })

  it('truncates to the window and flags the truncation, exactly like the growing window does', () => {
    const wrapper = makeHookWrapper()

    const narrow = renderHook(() => useLlmCalls('DAY', {}, 3), { wrapper })
    expect(narrow.result.current.data.items).toHaveLength(3)
    expect(narrow.result.current.data.hasMore).toBe(true)

    const exact = renderHook(() => useLlmCalls('DAY', {}, 7), { wrapper })
    expect(exact.result.current.data.items).toHaveLength(7)
    expect(exact.result.current.data.hasMore).toBe(false)
  })

  it('narrows to one account on userId, like the server does', () => {
    const anna = renderHook(() => useLlmCalls('DAY', { userId: '00000000-0000-4000-8000-000000000002' }, 50), { wrapper: makeHookWrapper() })
    expect(anna.result.current.data.items.length).toBeGreaterThan(0)
    expect(anna.result.current.data.items.every((i) => i.createdBy === '00000000-0000-4000-8000-000000000002')).toBe(true)
  })
})

describe('useLlmCalls (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns the honest empty (never the seed) while unresolved', () => {
    server.use(http.get(`${API_BASE}/api/llm-usage/calls`, () => new Promise(() => {}))) // never resolves
    const { result } = renderHook(() => useLlmCalls('DAY', {}, 50), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual(LLM_CALLS_EMPTY)
  })

  it('passes the filters and the limit as query parameters', async () => {
    let seen = ''
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls`, ({ request }) => {
        seen = new URL(request.url).search
        return HttpResponse.json({ items: [], hasMore: false })
      }),
    )

    const { result } = renderHook(
      () => useLlmCalls('WEEK', { feature: 'meal_coach', status: 'ERROR', userId: 'u-1' }, 100),
      { wrapper: makeHookWrapper() },
    )

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(seen).toContain('period=WEEK')
    expect(seen).toContain('feature=meal_coach')
    expect(seen).toContain('status=ERROR')
    expect(seen).toContain('limit=100')
    expect(seen).toContain('userId=u-1')
  })
})

describe('useLlmCall (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('serves the demo call detail synchronously (no loading frame)', () => {
    const { result } = renderHook(() => useLlmCall('22222222-2222-4222-8222-222222222222'), { wrapper: makeHookWrapper() })
    expect(result.current.data).toEqual(LLM_CALL_DETAIL_MOCK)
    expect(result.current.data.pricingSnapshot?.sourceModel).toBe('gemini-2.5-flash')
  })
})

describe('useLlmCall (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('returns the honest empty (never the seed) while unresolved, then the fetched detail', async () => {
    server.use(
      http.get(`${API_BASE}/api/llm-usage/calls/33333333-3333-4333-8333-333333333333`, () =>
        HttpResponse.json({
          ...LLM_CALL_DETAIL_MOCK,
          id: '33333333-3333-4333-8333-333333333333',
          feature: 'meal_draft',
        }),
      ),
    )

    const { result } = renderHook(() => useLlmCall('33333333-3333-4333-8333-333333333333'), { wrapper: makeHookWrapper() })

    expect(result.current.data).toEqual(LLM_CALL_DETAIL_EMPTY)
    await waitFor(() => expect(result.current.data.id).toBe('33333333-3333-4333-8333-333333333333'))
    expect(result.current.data.feature).toBe('meal_draft')
  })
})
