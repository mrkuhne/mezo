import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { makeHookWrapper, makeHookWrapperWithClient } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import {
  useDiscardRecovery,
  useOpenRecovery,
  useRecovery,
  useRecoveryCheckIn,
  useReleaseDay,
  useUndoBetter,
  useUnreleaseDay,
  useWaiveComeback,
} from '@/data/train/recoveryHooks'
import { decideReturn, mockCheckIn, mockOpen, recoveryEmpty } from '@/data/train/recoveryMock'
import type { RecoveryState } from '@/data/train/recoveryApi'
import { addDays, localDateString } from '@/shared/lib/dates'

afterEach(() => vi.unstubAllEnvs())

const URL = `${API_BASE}/api/train/recovery`
const today = localDateString()

function useAll() {
  return {
    state: useRecovery(),
    open: useOpenRecovery(),
    checkIn: useRecoveryCheckIn(),
    undo: useUndoBetter(),
    discard: useDiscardRecovery(),
    release: useReleaseDay(),
    unrelease: useUnreleaseDay(),
    waive: useWaiveComeback(),
  }
}

describe('recoveryMock — the backend return rule', () => {
  it('≤2 days CONTINUE (1 ramp), 3–9 RESUME, ≥10 STEP_BACK (2 ramp)', () => {
    expect(decideReturn('2026-09-27', '2026-09-29')).toEqual({ rule: 'CONTINUE', daysOut: 2, rampSessions: 1 })
    expect(decideReturn('2026-09-26', '2026-09-29')).toEqual({ rule: 'RESUME', daysOut: 3, rampSessions: 2 })
    expect(decideReturn('2026-09-20', '2026-09-29')).toEqual({ rule: 'RESUME', daysOut: 9, rampSessions: 2 })
    expect(decideReturn('2026-09-19', '2026-09-29')).toEqual({ rule: 'STEP_BACK', daysOut: 10, rampSessions: 2 })
  })

  it('BETTER on the start day is too early, like the server', () => {
    const open = mockOpen(recoveryEmpty, { category: 'ILLNESS', estimate: 'TODAY' }, '2026-09-29')
    expect(() => mockCheckIn(open, 'BETTER', '2026-09-29')).toThrow('TRAIN_RECOVERY_TOO_EARLY')
  })

  it('a RESUME return shifts whole weeks and states the new end date', () => {
    const open = mockOpen(recoveryEmpty, { category: 'STOMACH', estimate: 'WEEK', startDate: '2026-09-25' }, '2026-09-29')
    const back = mockCheckIn(open, 'BETTER', '2026-09-29').period!.return!
    expect(back.rule).toBe('RESUME')
    expect(back.shiftDays % 7).toBe(0)
    expect(back.shiftDays).toBe(7) // started in the week before today's
    expect(back.newEndDate).not.toBeNull()
  })
})

describe('useRecovery (mock mode)', () => {
  it('starts with no period', () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useRecovery(), { wrapper: makeHookWrapper() })
    expect(result.current.recovery).toEqual(recoveryEmpty)
  })

  it('open → protected days; BETTER → return set; undo-better → back to open', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useAll(), { wrapper: makeHookWrapper() })
    const start = addDays(today, -3)
    act(() => result.current.open.mutate({ category: 'ILLNESS', estimate: 'FEW_DAYS', startDate: start }))
    await waitFor(() => expect(result.current.state.recovery.period).toBeTruthy())
    const opened = result.current.state.recovery
    expect(opened.period).toMatchObject({ category: 'ILLNESS', startDate: start, endedOn: null, dayIndex: 4, estimateExpired: true })
    expect(opened.protectedDates[0]).toBe(start)
    expect(opened.protectedDates).toContain(today)
    expect(opened.protectedDates).toContain(addDays(today, 13))

    act(() => result.current.checkIn.mutate('BETTER'))
    await waitFor(() => expect(result.current.state.recovery.period?.return).toBeTruthy())
    const ended = result.current.state.recovery
    expect(ended.period).toMatchObject({ endedOn: today, return: { rule: 'RESUME', daysOut: 3, rampSessions: 2 } })
    expect(ended.protectedDates).toEqual([start, addDays(start, 1), addDays(start, 2)])
    expect(ended.comeback).toEqual({ total: 2, done: 0, waived: false })

    act(() => result.current.undo.mutate())
    await waitFor(() => expect(result.current.state.recovery.period?.endedOn).toBeNull())
    expect(result.current.state.recovery.period?.return).toBeNull()
    expect(result.current.state.recovery.comeback).toBeNull()
    expect(result.current.state.recovery.protectedDates).toContain(today)
  })

  it('release / unrelease a protected day; waive the comeback; discard', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useAll(), { wrapper: makeHookWrapper() })
    act(() => result.current.open.mutate({ category: 'INJURY', estimate: 'UNKNOWN', startDate: addDays(today, -1) }))
    await waitFor(() => expect(result.current.state.recovery.period).toBeTruthy())

    act(() => result.current.release.mutate({ date: today, lighten: false }))
    await waitFor(() => expect(result.current.state.recovery.protectedDates).not.toContain(today))
    expect(result.current.state.recovery.period).toMatchObject({ releasedDates: [today], releasedUnlightened: [today] })

    act(() => result.current.unrelease.mutate(today))
    await waitFor(() => expect(result.current.state.recovery.protectedDates).toContain(today))

    act(() => result.current.checkIn.mutate('BETTER'))
    await waitFor(() => expect(result.current.state.recovery.comeback).toEqual({ total: 1, done: 0, waived: false }))
    act(() => result.current.waive.mutate())
    await waitFor(() => expect(result.current.state.recovery.comeback).toEqual({ total: 0, done: 0, waived: true }))

    act(() => result.current.discard.mutate())
    await waitFor(() => expect(result.current.state.recovery).toEqual(recoveryEmpty))
  })
})

describe('useRecovery (real mode)', () => {
  const serverState: RecoveryState = {
    period: {
      id: 'p1', category: 'TRAVEL', estimate: 'WEEK', startDate: today, expectedEnd: addDays(today, 6), endedOn: null,
      dayIndex: 1, estimateExpired: false, checkedInToday: false, releasedDates: [], releasedUnlightened: [], return: null,
    },
    protectedDates: [today],
    comeback: null,
  }

  it('reads the server state verbatim (empty, never a seed, while unresolved)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(http.get(URL, () => HttpResponse.json(serverState)))
    const { result } = renderHook(() => useRecovery(), { wrapper: makeHookWrapper() })
    expect(result.current.recovery).toEqual(recoveryEmpty)
    await waitFor(() => expect(result.current.recovery).toEqual(serverState))
  })

  it('open PUTs the request, stores the answer and invalidates the dependents', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let put: unknown = null
    server.use(
      http.get(URL, () => HttpResponse.json(recoveryEmpty)),
      http.put(URL, async ({ request }) => {
        put = await request.json()
        return HttpResponse.json(serverState)
      }),
    )
    const { wrapper, client } = makeHookWrapperWithClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useAll(), { wrapper })
    act(() => result.current.open.mutate({ category: 'TRAVEL', estimate: 'WEEK' }))
    await waitFor(() => expect(put).toEqual({ category: 'TRAVEL', estimate: 'WEEK' }))
    await waitFor(() => expect(spy).toHaveBeenCalled())
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey))
    for (const k of [['train', 'recovery'], ['train', 'plannedSkips'], ['train', 'workoutToday'], ['train', 'mesocycles'], ['train', 'mesoReport'], ['train', 'mesoVolumeArc'], ['fuelDay']]) {
      expect(keys).toContain(JSON.stringify(k))
    }
  })

  it('check-in POSTs the answer; discard DELETEs and clears the state', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let answer: unknown = null
    let deleted = false
    server.use(
      http.get(URL, () => HttpResponse.json(deleted ? recoveryEmpty : serverState)),
      http.post(`${URL}/check-in`, async ({ request }) => {
        answer = await request.json()
        return HttpResponse.json({ ...serverState, period: { ...serverState.period!, checkedInToday: true } })
      }),
      http.delete(URL, () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => useAll(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.state.recovery.period).toBeTruthy())
    act(() => result.current.checkIn.mutate('NOT_YET'))
    await waitFor(() => expect(answer).toEqual({ answer: 'NOT_YET' }))
    act(() => result.current.discard.mutate())
    await waitFor(() => expect(result.current.state.recovery).toEqual(recoveryEmpty))
    expect(deleted).toBe(true)
  })
})
