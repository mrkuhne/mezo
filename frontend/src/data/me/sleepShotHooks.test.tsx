import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useSleepShot } from '@/data/me/sleepHooks'
import { MOCK_SLEEP_SHOT_DRAFT } from '@/data/me/sleepShot'

afterEach(() => vi.unstubAllEnvs())

describe('useSleepShot (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('returns the canonical mock draft without any network', async () => {
    const { result } = renderHook(() => useSleepShot(), { wrapper: makeHookWrapper() })
    const draft = await result.current.extract(new File(['x'], 's.png', { type: 'image/png' }))
    expect(draft).toEqual(MOCK_SLEEP_SHOT_DRAFT)
  })
})

describe('useSleepShot (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('POSTs multipart and maps nullable fields to nulls', async () => {
    let contentType: string | null = null
    server.use(
      http.post(`${API_BASE}/api/sleep/screenshot`, ({ request }) => {
        contentType = request.headers.get('content-type')
        return HttpResponse.json({
          bedtime: '00:42', wakeup: '09:03', durationH: 7.48, inBedMin: 501,
          awakeMin: 52, lightMin: 206, remMin: 144, deepMin: 100,
          sourceQualityPct: 95, confidence: 1, needsReview: false,
        })
      }),
    )
    const { result } = renderHook(() => useSleepShot(), { wrapper: makeHookWrapper() })
    const draft = await result.current.extract(new File(['x'], 's.png', { type: 'image/png' }))
    expect(contentType).toMatch(/^multipart\/form-data/)
    expect(draft.bedtime).toBe('00:42')
    expect(draft.inBedMin).toBe(501)

    server.use(http.post(`${API_BASE}/api/sleep/screenshot`, () =>
      HttpResponse.json({ confidence: 0, needsReview: true })))
    const partial = await result.current.extract(new File(['x'], 's.png', { type: 'image/png' }))
    expect(partial.bedtime).toBeNull()
    expect(partial.needsReview).toBe(true)
  })

  it('rejects with ApiError on 502 so the sheet can fall back to pick', async () => {
    server.use(http.post(`${API_BASE}/api/sleep/screenshot`, () =>
      HttpResponse.json([{ code: 'SLEEP_SHOT_EXTRACT_FAILED', type: 'REQUEST' }], { status: 502 })))
    const { result } = renderHook(() => useSleepShot(), { wrapper: makeHookWrapper() })
    await expect(result.current.extract(new File(['x'], 's.png', { type: 'image/png' })))
      .rejects.toMatchObject({ status: 502 })
  })
})
