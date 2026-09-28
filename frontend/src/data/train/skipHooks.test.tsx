import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { usePlannedSkips } from '@/data/train/skipHooks'
import type { PlannedSkipResponse } from '@/data/train/skipApi'

afterEach(() => vi.unstubAllEnvs())

const URL = `${API_BASE}/api/train/skips`

const serverRow = (over: Partial<PlannedSkipResponse> = {}): PlannedSkipResponse => ({
  id: 's1', date: '2026-09-28', kind: 'GYM', dayOfWeek: null, time: null, sessionKey: null,
  reasonCategory: 'NONE', reasonText: null, source: 'USER', serious: false, freePass: true, excused: true,
  ...over,
})

describe('usePlannedSkips', () => {
  it('mock mode: starts empty', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    expect(result.current.skips).toEqual([])
  })

  it('mock mode: skip() adds one NONE row with the weekly free pass', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-28' }))
    await waitFor(() => expect(result.current.skips).toHaveLength(1))
    expect(result.current.skips[0]).toMatchObject({ kind: 'GYM', date: '2026-09-28', reasonCategory: 'NONE', freePass: true, excused: true })
  })

  it('mock mode: setReason(ILLNESS) upserts the same row as serious, not the free pass', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    let firstId = ''
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-28' }, (s) => { firstId = s.id }))
    await waitFor(() => expect(result.current.skips).toHaveLength(1))
    act(() => result.current.setReason({ kind: 'GYM', date: '2026-09-28' }, 'ILLNESS'))
    await waitFor(() => expect(result.current.skips[0]?.reasonCategory).toBe('ILLNESS'))
    expect(result.current.skips).toHaveLength(1)
    expect(result.current.skips[0]).toMatchObject({ id: firstId, serious: true, freePass: false, excused: true })
  })

  it('mock mode: undo removes the row', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-28' }))
    await waitFor(() => expect(result.current.skips).toHaveLength(1))
    const id = result.current.skips[0]!.id
    act(() => result.current.undo(id))
    await waitFor(() => expect(result.current.skips).toEqual([]))
  })

  it('real mode: lists the server rows verbatim (server verdicts trusted, no re-judging)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(URL, () => HttpResponse.json([serverRow({ id: 'r1', freePass: false, excused: false })])))
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    expect(result.current.skips).toEqual([])
    await waitFor(() => expect(result.current.skips).toHaveLength(1))
    expect(result.current.skips[0]).toMatchObject({ id: 'r1', freePass: false, excused: false })
  })

  it('real mode: setReason PUTs the request and undo DELETEs by id, both calling onDone', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let put: unknown = null
    let deletedId = ''
    server.use(
      http.get(URL, () => HttpResponse.json([])),
      http.put(URL, async ({ request }) => {
        put = await request.json()
        return HttpResponse.json(serverRow({ id: 'r2', reasonCategory: 'OTHER', reasonText: 'utazás', freePass: false, excused: false }))
      }),
      http.delete(`${URL}/r2`, ({ params }) => {
        deletedId = String(params.id ?? 'r2')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const onDone = vi.fn()
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.skips).toEqual([]))

    act(() => result.current.setReason({ kind: 'GYM', date: '2026-09-28' }, 'OTHER', 'utazás', onDone))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(put).toMatchObject({ date: '2026-09-28', kind: 'GYM', reasonCategory: 'OTHER', reasonText: 'utazás' })
    expect(onDone.mock.calls[0]![0]).toMatchObject({ id: 'r2', reasonCategory: 'OTHER' })

    act(() => result.current.undo('r2', () => onDone()))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(2))
    expect(deletedId).toBe('r2')
  })
})
