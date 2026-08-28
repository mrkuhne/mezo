import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useWeeklyReview } from '@/data/me/weeklyReviewHooks'
import { mockWeeklyReview, mockWeeklyReviewDigest } from '@/data/me/weeklyReviewMock'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'

describe('useWeeklyReview (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('serves the seeded review + digest for a past week', () => {
    const start = '2026-05-18'
    const { result } = renderHook(() => useWeeklyReview(start), { wrapper: makeHookWrapper() })
    expect(result.current.review).toEqual(mockWeeklyReview(start))
    expect(result.current.digest).toEqual(mockWeeklyReviewDigest(start))
    expect(result.current.mode).toBe('mock')
  })

  it('returns a null review for the CURRENT mock week (ghost state)', () => {
    const { result } = renderHook(() => useWeeklyReview(mondayIso()), { wrapper: makeHookWrapper() })
    expect(result.current.review).toBeNull()
  })

  it('regenerate resolves without hitting the network', async () => {
    const { result } = renderHook(() => useWeeklyReview('2026-05-18'), { wrapper: makeHookWrapper() })
    await act(() => result.current.regenerate())
    expect(result.current.regenerating).toBe(false)
  })
})

describe('useWeeklyReview (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('honest-null on a 404 (no review generated yet), digest still resolves', async () => {
    const { result } = renderHook(() => useWeeklyReview('2026-06-01'), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.digest?.patterns.length).toBeGreaterThan(0))
    expect(result.current.review).toBeNull()
    expect(result.current.digest?.patterns).toHaveLength(1)
    expect(result.current.mode).toBe('live')
  })

  it('fetches the persisted review when the backend has one', async () => {
    const start = '2026-06-01'
    server.use(
      http.get(`${API_BASE}/api/proactive/weekly-review/${start}`, () =>
        HttpResponse.json({
          id: 'r1', weekStart: start, summary: 'Live summary', dayNotes: [], highlights: [],
          generatedAt: '2026-06-08T06:00:00Z', stale: true,
        })),
    )
    const { result } = renderHook(() => useWeeklyReview(start), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.review).not.toBeNull())
    expect(result.current.review?.summary).toBe('Live summary')
    expect(result.current.review?.stale).toBe(true)
  })

  it('regenerate POSTs then invalidates the review query so the fresh row is refetched', async () => {
    const start = '2026-06-01'
    let getCalls = 0
    server.use(
      http.get(`${API_BASE}/api/proactive/weekly-review/${start}`, () => {
        getCalls += 1
        return getCalls === 1
          ? new HttpResponse(null, { status: 404 })
          : HttpResponse.json({
              id: 'r2', weekStart: start, summary: 'Regenerated', dayNotes: [], highlights: [],
              generatedAt: '2026-06-08T07:00:00Z', stale: false,
            })
      }),
    )
    const { result } = renderHook(() => useWeeklyReview(start), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.review).toBeNull())

    await act(() => result.current.regenerate())

    await waitFor(() => expect(result.current.review?.summary).toBe('Regenerated'))
    expect(getCalls).toBeGreaterThanOrEqual(2)
  })
})
