import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { useTodayReadiness } from '@/data/train/readinessHooks'
import { readinessMock } from '@/data/train/readinessMock'

afterEach(() => vi.unstubAllEnvs())

const URL = `${API_BASE}/api/train/readiness/today`

describe('useTodayReadiness', () => {
  it('mock mode: serves the prototype seed synchronously', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useTodayReadiness(), { wrapper: makeHookWrapper() })
    expect(result.current.readiness).toEqual(readinessMock)
    expect(result.current.readiness.reasons.map((r) => `${r.item} ${r.value}`))
      .toEqual(['rested 4', 'soreness 7', 'motivation 5'])
    expect(result.current.readiness.care[0]).toMatchObject({ exerciseName: 'Rear Delt Fly', regionLabel: 'vállad', intensity: 5 })
  })

  it('mock mode: lighten, undo and keep move the state in the cache', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useTodayReadiness(), { wrapper: makeHookWrapper() })
    act(() => result.current.choose('LIGHTEN'))
    await waitFor(() => expect(result.current.readiness.state).toBe('LIGHTENED'))
    act(() => result.current.undo())
    await waitFor(() => expect(result.current.readiness.state).toBe('OFFER'))
    act(() => result.current.choose('KEEP'))
    await waitFor(() => expect(result.current.readiness.state).toBe('KEPT'))
  })

  it('real mode: shows NONE (never the seed) until the read lands, then the server answer', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(URL, () => HttpResponse.json({ ...readinessMock, care: [] })))
    const { result } = renderHook(() => useTodayReadiness(), { wrapper: makeHookWrapper() })
    expect(result.current.readiness.state).toBe('NONE')
    await waitFor(() => expect(result.current.readiness.state).toBe('OFFER'))
    expect(result.current.readiness.care).toEqual([])
  })

  it('real mode: posts the choice, deletes on undo, and calls onDone after each', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const posted: unknown[] = []
    let deleted = 0
    server.use(
      http.get(URL, () => HttpResponse.json(readinessMock)),
      http.post(URL, async ({ request }) => {
        posted.push(await request.json())
        return HttpResponse.json({ ...readinessMock, state: 'LIGHTENED' })
      }),
      http.delete(URL, () => {
        deleted++
        return HttpResponse.json(readinessMock)
      }),
    )
    const onDone = vi.fn()
    const { result } = renderHook(() => useTodayReadiness(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.readiness.state).toBe('OFFER'))

    act(() => result.current.choose('LIGHTEN', onDone))
    await waitFor(() => expect(result.current.readiness.state).toBe('LIGHTENED'))
    expect(posted).toEqual([{ choice: 'LIGHTEN' }])

    act(() => result.current.undo(onDone))
    await waitFor(() => expect(result.current.readiness.state).toBe('OFFER'))
    expect(deleted).toBe(1)
    expect(onDone).toHaveBeenCalledTimes(2)
  })
})
