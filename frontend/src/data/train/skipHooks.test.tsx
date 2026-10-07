import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { usePlannedSkips, PLANNED_SKIPS_QUERY_KEY } from '@/data/train/skipHooks'
import { DEFAULT_QUERY_STALE_TIME_MS } from '@/data/useDualQuery'
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
  it('mock mode: a MEAL skip keeps plannedKcal, is excused without the free pass and leaves the pass to a GYM skip', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    act(() => result.current.skip({ kind: 'MEAL', date: '2026-09-28', sessionKey: 'lunch#1' }, undefined, 640))
    await waitFor(() => expect(result.current.skips).toHaveLength(1))
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-29' }))
    await waitFor(() => expect(result.current.skips).toHaveLength(2))
    expect(result.current.skips.find((s) => s.kind === 'MEAL')).toMatchObject({ plannedKcal: 640, excused: true, freePass: false })
    expect(result.current.skips.find((s) => s.kind === 'GYM')?.freePass).toBe(true)
  })

  it('mock mode: re-upserting a MEAL skip without plannedKcal keeps the stored snapshot', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    const key = { kind: 'MEAL' as const, date: '2026-09-28', sessionKey: 'snack#1' }
    act(() => result.current.skip(key, undefined, 420))
    await waitFor(() => expect(result.current.skips).toHaveLength(1))
    act(() => result.current.setReason(key, 'NOT_HUNGRY'))
    await waitFor(() => expect(result.current.skips[0]?.reasonCategory).toBe('NOT_HUNGRY'))
    expect(result.current.skips).toHaveLength(1)
    expect(result.current.skips[0]).toMatchObject({ plannedKcal: 420 })
  })

  it('real mode: plannedKcal is sent for a MEAL skip only', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.get(URL, () => HttpResponse.json([])),
      http.put(URL, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>)
        return HttpResponse.json(serverRow({ kind: 'MEAL', sessionKey: 'lunch#1', plannedKcal: 640 }))
      }),
    )
    const onDone = vi.fn()
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    act(() => result.current.skip({ kind: 'MEAL', date: '2026-09-28', sessionKey: 'lunch#1' }, onDone, 640))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-28' }, onDone, 640))
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(2))
    expect(bodies[0]).toMatchObject({ kind: 'MEAL', plannedKcal: 640 })
    expect(bodies[1]).not.toHaveProperty('plannedKcal')
    expect(onDone.mock.calls[0]![0]).toMatchObject({ plannedKcal: 640 })
  })

  it('mock mode: OTHER text is trimmed, blank becomes null, text kept only for OTHER (mirrors the backend)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const t = { kind: 'GYM' as const, date: '2026-09-28' }
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    act(() => result.current.setReason(t, 'OTHER', '  családi program  '))
    await waitFor(() => expect(result.current.skips[0]?.reasonText).toBe('családi program'))
    act(() => result.current.setReason(t, 'OTHER', '   '))
    await waitFor(() => expect(result.current.skips[0]?.reasonText).toBeNull())
    act(() => result.current.setReason(t, 'TIRED', 'nem kell'))
    await waitFor(() => expect(result.current.skips[0]?.reasonCategory).toBe('TIRED'))
    expect(result.current.skips[0]?.reasonText).toBeNull()
  })

  it('real mode: the list query uses the app-default staleTime (no refetch per useTrain() mount)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { wrapper, client } = makeHookWrapperWithClient()
    renderHook(() => usePlannedSkips(), { wrapper })
    const q = client.getQueryCache().findAll({ queryKey: PLANNED_SKIPS_QUERY_KEY })[0]
    expect((q?.options as { staleTime?: number }).staleTime).toBe(DEFAULT_QUERY_STALE_TIME_MS)
  })

  it('real mode: the default PUT handler echoes a USER row', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const onDone = vi.fn()
    const { result } = renderHook(() => usePlannedSkips(), { wrapper: makeHookWrapper() })
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-28' }, onDone))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onDone.mock.calls[0]![0]).toMatchObject({ source: 'USER', reasonCategory: 'NONE' })
  })

  it('real mode: a skip write invalidates the reads whose values depend on skips', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    const { wrapper, client } = makeHookWrapperWithClient()
    const keys = [
      ['train', 'weekWorkouts'], ['train', 'mesoReport', 'm1'], ['progressionProfile'],
      ['dailyQuests', '2026-09-28'], ['fuelDay', '2026-09-28'], ['train', 'workoutToday', null],
    ]
    for (const k of keys) client.setQueryData(k, { seeded: true })
    const onDone = vi.fn()
    const { result } = renderHook(() => usePlannedSkips(), { wrapper })
    act(() => result.current.skip({ kind: 'GYM', date: '2026-09-28' }, onDone))
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    await waitFor(() => {
      for (const k of keys) expect(client.getQueryState(k)?.isInvalidated, JSON.stringify(k)).toBe(true)
    })
  })
})
