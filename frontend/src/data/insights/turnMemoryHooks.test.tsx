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

  test('toggleAboutMe sets and clears a stand-in copy id in the cache (mezo-d6ivw.13)', async () => {
    const wrapper = makeHookWrapper()
    const anchor = { id: 'mock-turn-0', ordinal: 0, text: 'x' }
    const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }), { wrapper })
    await waitFor(() => expect(result.current.m.memory.learned).toHaveLength(1))
    expect(result.current.m.memory.learned[0].aboutMeFactId).toBeNull()
    await act(() => result.current.a.toggleAboutMe('mock-pf-dori', true))
    await waitFor(() => expect(result.current.m.memory.learned[0].aboutMeFactId).toBe('mock-aboutme-mock-pf-dori'))
    await act(() => result.current.a.toggleAboutMe('mock-pf-dori', false))
    await waitFor(() => expect(result.current.m.memory.learned[0].aboutMeFactId).toBeNull())
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
        proposed: [], forgotten: [], forgetRequest: false,
      })
    }))
    const { result } = renderHook(() => useTurnMemory('c-1', { id: 'u-1', ordinal: 0, text: 'x' }), { wrapper: makeHookWrapper() })
    expect(result.current.pending).toBe(true)
    await waitFor(() => expect(result.current.memory.learned[0]?.who).toBe('Dóri'), { timeout: 6000 })
  })

  test('without an anchor nothing is fetched', () => {
    const { result } = renderHook(() => useTurnMemory('c-1', null), { wrapper: makeHookWrapper() })
    expect(result.current).toEqual({ memory: { learned: [], proposed: [], forgotten: [], forgetRequest: false }, pending: false, loaded: false })
  })

  // Fix round 1 (mezo-d6ivw.12): the ladder must be 2000ms → 3000ms → 5000ms, then stop —
  // proven with fake timers so a future off-by-one regresses loudly instead of silently.
  test('polls at 2000ms, then 3000ms, then 5000ms, then stops', async () => {
    vi.useFakeTimers()
    try {
      const callTimes: number[] = []
      server.use(http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () => {
        callTimes.push(Date.now())
        return HttpResponse.json({ learned: [], proposed: [], forgotten: [], forgetRequest: false })
      }))
      renderHook(() => useTurnMemory('c-1', { id: 'u-1', ordinal: 0, text: 'x' }), { wrapper: makeHookWrapper() })

      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      expect(callTimes).toHaveLength(1) // the initial fetch, t=0

      await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
      expect(callTimes).toHaveLength(2) // poll #1 at t=2000 (TURN_MEMORY_POLL_DELAYS[0])

      await act(async () => { await vi.advanceTimersByTimeAsync(3000) })
      expect(callTimes).toHaveLength(3) // poll #2 at t=5000 (+3000, TURN_MEMORY_POLL_DELAYS[1])

      await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
      expect(callTimes).toHaveLength(4) // poll #3 at t=10000 (+5000, TURN_MEMORY_POLL_DELAYS[2])

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
      expect(callTimes).toHaveLength(4) // ladder exhausted — no further polls
    } finally {
      vi.useRealTimers()
    }
  })

  // Fix round (mezo-d6ivw.12): a forget request's row is extraction-blocked — one answer is final.
  test('a forget request is fetched once: no poll, not pending, loaded', async () => {
    vi.useFakeTimers()
    try {
      let calls = 0
      server.use(http.get(`${API_BASE}/api/companion/conversation/:id/turn-memory`, () => {
        calls++
        return HttpResponse.json({ learned: [], proposed: [], forgotten: [], forgetRequest: true })
      }))
      const { result } = renderHook(() => useTurnMemory('c-1', { id: 'u-9', ordinal: 0, text: 'x' }), { wrapper: makeHookWrapper() })
      await act(async () => { await vi.advanceTimersByTimeAsync(0) })
      await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
      expect(calls).toBe(1)
      expect(result.current.loaded).toBe(true)
      expect(result.current.pending).toBe(false)
      expect(result.current.memory.forgetRequest).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  // Final review (mezo-d6ivw.12): the backend returns only LIVE items, so a chip action must not
  // let a later poll (or an invalidation) drop the acted-on item — its confirmation would vanish.
  describe('a chip action survives the next poll', () => {
    const TURN = '/api/companion/conversation/:id/turn-memory'
    const learnedWire = { id: 'pf-1', personId: 'p-1', personName: 'Dóri', kind: 'preference', text: 'szereti a teát', createdAt: '2026-09-26T20:05:00Z' }
    const proposedWire = { id: 'lf-1', candidateText: 'Reggel edzel a legszívesebben', category: 'preference', userDecision: null,
      refinedText: null, promotedFactId: null, createdAt: '2026-09-26T20:05:00Z' }
    const anchor = { id: 'u-1', ordinal: 0, text: 'x' }
    const flush = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    test('reject → a later poll → the proposal stays, marked rejected, and polling stops', async () => {
      let calls = 0
      let decided = false
      server.use(
        http.get(`${API_BASE}${TURN}`, () => {
          calls++
          return HttpResponse.json({ learned: [], proposed: decided ? [] : [proposedWire], forgotten: [], forgetRequest: false })
        }),
        http.post(`${API_BASE}/api/companion/fact/candidate/:id/decision`, () => {
          decided = true
          return HttpResponse.json({ ...proposedWire, userDecision: 'reject' })
        }),
      )
      const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }),
        { wrapper: makeHookWrapper() })
      await flush(0)
      expect(result.current.m.memory.proposed).toHaveLength(1)

      await act(() => result.current.a.reject('lf-1'))
      const callsAfterAction = calls
      await flush(20_000)

      expect(result.current.m.memory.proposed).toEqual([expect.objectContaining({ id: 'lf-1', rejected: true })])
      expect(calls).toBe(callsAfterAction)
    })

    test('toggleAboutMe → the server copy id lands in the cache, and a later poll keeps it (mezo-d6ivw.13)', async () => {
      let calls = 0
      server.use(
        http.get(`${API_BASE}${TURN}`, () => {
          calls++
          return HttpResponse.json({ learned: [{ ...learnedWire, aboutMeFactId: null }], proposed: [], forgotten: [], forgetRequest: false })
        }),
        http.post(`${API_BASE}/api/companion/turn-memory/person-fact/:id/about-me`, ({ params }) =>
          HttpResponse.json({ personFactId: params.id, aboutMeFactId: 'kf-7' })),
      )
      const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }),
        { wrapper: makeHookWrapper() })
      await flush(0)
      expect(result.current.m.memory.learned[0].aboutMeFactId).toBeNull()

      await act(() => result.current.a.toggleAboutMe('pf-1', true))
      const callsAfterAction = calls
      await flush(20_000)

      expect(result.current.m.memory.learned[0]).toEqual(expect.objectContaining({ id: 'pf-1', aboutMeFactId: 'kf-7' }))
      expect(calls).toBe(callsAfterAction)
    })

    test('undo → a later poll → the learned fact stays, marked undone', async () => {
      let undone = false
      server.use(
        http.get(`${API_BASE}${TURN}`, () =>
          HttpResponse.json({ learned: undone ? [] : [learnedWire], proposed: [], forgotten: [], forgetRequest: false })),
        http.delete(`${API_BASE}/api/people/:personId/facts/:factId`, () => {
          undone = true
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }),
        { wrapper: makeHookWrapper() })
      await flush(0)
      expect(result.current.m.memory.learned).toHaveLength(1)

      await act(() => result.current.a.undoLearned('p-1', 'pf-1'))
      await flush(20_000)

      expect(result.current.m.memory.learned).toEqual([expect.objectContaining({ id: 'pf-1', undone: true })])
    })

    test('accept → kept with the promoted fact from the decision (no refetch); its undo then survives a poll', async () => {
      let calls = 0
      let state: 'ask' | 'kept' | 'gone' = 'ask'
      server.use(
        http.get(`${API_BASE}${TURN}`, () => {
          calls++
          const proposed = state === 'gone' ? []
            : [{ ...proposedWire, userDecision: state === 'kept' ? 'accept' : null, promotedFactId: state === 'kept' ? 'kf-1' : null }]
          return HttpResponse.json({ learned: [], proposed, forgotten: [], forgetRequest: false })
        }),
        http.post(`${API_BASE}/api/companion/fact/candidate/:id/decision`, () => {
          state = 'kept'
          return HttpResponse.json({ ...proposedWire, userDecision: 'accept', promotedFactId: 'kf-1' })
        }),
        http.delete(`${API_BASE}/api/companion/fact/:id`, () => {
          state = 'gone'
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const { result } = renderHook(() => ({ m: useTurnMemory('c-1', anchor), a: useTurnMemoryActions('c-1', anchor) }),
        { wrapper: makeHookWrapper() })
      await flush(0)

      const callsBeforeAccept = calls
      await act(() => result.current.a.accept('lf-1'))
      await flush(0) // the query cache notifies subscribers on a (faked) timer tick
      expect(result.current.m.memory.proposed[0]).toEqual(expect.objectContaining({ id: 'lf-1', state: 'kept', promotedFactId: 'kf-1' }))
      expect(calls).toBe(callsBeforeAccept)

      await act(() => result.current.a.forgetKept('kf-1'))
      await flush(20_000)
      expect(result.current.m.memory.proposed).toEqual([expect.objectContaining({ id: 'lf-1', state: 'kept', undone: true })])
    })

    test('forget-all settles the other turns of the conversation too', async () => {
      let calls = 0
      let forgotten = false
      server.use(
        http.get(`${API_BASE}${TURN}`, ({ request }) => {
          if (new URL(request.url).searchParams.get('messageId') === 'u-0') calls++
          return HttpResponse.json({ learned: forgotten ? [] : [learnedWire], proposed: [], forgotten: [], forgetRequest: false })
        }),
        http.post(`${API_BASE}/api/companion/conversation/:id/forget-learned`, () => {
          forgotten = true
          return HttpResponse.json({ forgotten: [{ kind: 'person_fact', refId: 'pf-1', personId: 'p-1', who: 'Dóri',
            text: 'szereti a teát', createdAt: '2026-09-26T20:05:00Z', pending: false }] })
        }),
      )
      const wrapper = makeHookWrapper()
      const earlier = renderHook(() => useTurnMemory('c-1', { id: 'u-0', ordinal: 0, text: 'x' }), { wrapper })
      const forgetTurn = renderHook(() => useTurnMemoryActions('c-1', { id: 'u-2', ordinal: 1, text: 'Ezt ne jegyezd meg.' }), { wrapper })
      await flush(0)
      expect(earlier.result.current.memory.learned).toHaveLength(1)

      await act(async () => { await forgetTurn.result.current.forgetAll() })
      const callsAfter = calls
      await flush(20_000)

      expect(earlier.result.current.memory.learned).toHaveLength(1) // still there → "Elfelejtve · …"
      expect(calls).toBe(callsAfter)
    })
  })
})
