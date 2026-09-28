import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useTurnMemory, useTurnMemoryActions } from '@/data/insights/turnMemoryHooks'

describe('useTurnMemory (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('turn 0 seeds a learned person fact and an owner proposal; a forget text seeds the forgotten list', async () => {
    const { result } = renderHook(() => useTurnMemory('c-1', { id: 'mock-turn-0', ordinal: 0, text: 'Dórival nyertünk' }),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.memory.learned).toHaveLength(1))
    expect(result.current.memory.proposed[0].state).toBe('ask')
    const forget = renderHook(() => useTurnMemory('c-1', { id: 'mock-turn-4', ordinal: 2, text: 'Ezt ne jegyezd meg.' }),
      { wrapper: makeHookWrapper() })
    await waitFor(() => expect(forget.result.current.memory.forgotten).toHaveLength(2))
  })

  test('accept flips the proposal to kept in the cache', async () => {
    const wrapper = makeHookWrapper()
    const anchor = { id: 'mock-turn-0', ordinal: 0, text: 'x' }
    const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }), { wrapper })
    await waitFor(() => expect(result.current.m.memory.proposed).toHaveLength(1))
    await act(() => result.current.a.accept('mock-lf-self'))
    await waitFor(() => expect(result.current.m.memory.proposed[0].state).toBe('kept'))
  })
})

describe('useTurnMemory (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('polls the turn-memory endpoint and maps the wire', async () => {
    let calls = 0
    server.use(http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () => {
      calls++
      return HttpResponse.json({
        learned: calls === 1 ? [] : [{ id: 'pf-1', personId: 'p-1', personName: 'Dóri', kind: 'preference', text: 'szereti a teát', createdAt: '2026-09-26T20:05:00Z' }],
        proposed: [], forgotten: [],
      })
    }))
    const { result } = renderHook(() => useTurnMemory('c-1', { id: 'u-1', ordinal: 0, text: 'x' }), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(true)
    await waitFor(() => expect(result.current.memory.learned[0]?.who).toBe('Dóri'), { timeout: 6000 })
  })

  test('without an anchor nothing is fetched', () => {
    const { result } = renderHook(() => useTurnMemory('c-1', null), { wrapper: makeHookWrapper() })
    expect(result.current).toEqual({ memory: { learned: [], proposed: [], forgotten: [] }, pending: false })
  })
})
