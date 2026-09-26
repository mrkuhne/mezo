import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { candidateSeed } from '@/data/insights/knowledge'
import { lifeEventCandidateSeed } from '@/data/insights/graph'
import { useRoladInbox } from '@/features/insights/hooks/useRoladInbox'

describe('useRoladInbox (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('deciding a fact candidate "keep" (refined) leaves candidates and lands in settled with the refined title', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0))
    const target = candidateSeed[0]

    result.current.decideFact(target, 'refine', 'Pontosított tényszöveg')

    await waitFor(() =>
      expect(result.current.candidates.map((c) => c.id)).not.toContain(target.id))
    const settled = result.current.settled.find((s) => s.id === target.id)
    expect(settled).toMatchObject({
      id: target.id, kind: 'FACT', title: 'Pontosított tényszöveg', outcome: 'keep', edgeCount: 0,
    })
  })

  it('deciding a fact candidate "accept" (unrefined) lands in settled with the candidate text as title', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0))
    const target = candidateSeed[0]

    result.current.decideFact(target, 'accept')

    await waitFor(() =>
      expect(result.current.candidates.map((c) => c.id)).not.toContain(target.id))
    const settled = result.current.settled.find((s) => s.id === target.id)
    expect(settled).toMatchObject({
      id: target.id, kind: 'FACT', title: target.text, outcome: 'keep', edgeCount: 0,
    })
  })

  it('snoozing a life event leaves lifeEvents and lands in settled with outcome snooze', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.lifeEvents.length).toBeGreaterThan(0))
    const target = lifeEventCandidateSeed[0]

    result.current.decideLifeEvent(target, 'snooze')

    await waitFor(() =>
      expect(result.current.lifeEvents.map((c) => c.id)).not.toContain(target.id))
    const settled = result.current.settled.find((s) => s.id === target.id)
    expect(settled).toMatchObject({
      id: target.id, kind: target.kind, title: target.title, outcome: 'snooze',
      edgeCount: target.proposedEdgeCount,
    })
  })

  it('accepting a life event with a refined title uses the refined title in settled', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.lifeEvents.length).toBeGreaterThan(0))
    const target = lifeEventCandidateSeed[0]

    result.current.decideLifeEvent(target, 'accept', { title: 'Pontosított cím' })

    await waitFor(() =>
      expect(result.current.lifeEvents.map((c) => c.id)).not.toContain(target.id))
    const settled = result.current.settled.find((s) => s.id === target.id)
    expect(settled).toMatchObject({ id: target.id, title: 'Pontosított cím', outcome: 'keep' })
  })

  it('rejecting a fact candidate lands in settled with outcome reject', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0))
    const target = candidateSeed[0]

    result.current.decideFact(target, 'reject')

    await waitFor(() =>
      expect(result.current.candidates.map((c) => c.id)).not.toContain(target.id))
    const settled = result.current.settled.find((s) => s.id === target.id)
    expect(settled).toMatchObject({ id: target.id, outcome: 'reject' })
  })

  it('passes degraded/isPending/isError through from useKnowledge', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.degraded).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(typeof result.current.refetch).toBe('function')
  })

  // Rólad polish (mezo-plbev, item 2): the life-event query's own error/refetch, kept SEPARATE
  // from the fact-side isError — RoladInbox needs both independently to show a quiet retry line
  // without hiding otherwise-working fact cards.
  it('exposes isLifeEventsError/refetchLifeEvents separately from the fact-side isError', async () => {
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.isLifeEventsError).toBe(false)
    expect(typeof result.current.refetchLifeEvents).toBe('function')
  })
})

describe('useRoladInbox afterlife rollback on a failed decision (final-review fix, mezo-zpxv7)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  /** A promise the test itself resolves — the msw handler awaits it, so the request is held
   *  open for exactly as long as the assertions need, never a fixed wall-clock delay
   *  (mezo-plbev item 8: the old `delay(200)` guessed at a window instead of controlling it). */
  function deferred(): { promise: Promise<void>; resolve: () => void } {
    let resolve!: () => void
    const promise = new Promise<void>((r) => { resolve = r })
    return { promise, resolve }
  }

  it('a sikertelen fact-decision után a jelölt visszakerül a candidates listába, nem marad settled', async () => {
    const target = candidateSeed[0]
    const gate = deferred()
    server.use(
      http.post(`${API_BASE}/api/companion/fact/candidate/${target.id}/decision`, async () => {
        await gate.promise
        return new HttpResponse(null, { status: 500 })
      }),
    )
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0))

    result.current.decideFact(target, 'accept')

    // Optimistically settled first (the afterlife line shows immediately), while the request is
    // still held open by the gate...
    await waitFor(() => expect(result.current.settled.map((s) => s.id)).toContain(target.id))
    expect(result.current.candidates.map((c) => c.id)).not.toContain(target.id)
    // ...then rolls back once the gate is released and the mutation rejects: back in
    // candidates, out of settled.
    gate.resolve()
    await waitFor(() => expect(result.current.settled.map((s) => s.id)).not.toContain(target.id))
    expect(result.current.candidates.map((c) => c.id)).toContain(target.id)
  })

  it('a sikertelen életesemény-decision után a jelölt visszakerül a lifeEvents listába, nem marad settled', async () => {
    const target = lifeEventCandidateSeed[0]
    const gate = deferred()
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () =>
        HttpResponse.json([{
          id: target.id, kind: target.kind, title: target.title, summary: target.summary,
          occurredOn: target.occurredOn, proposedEdgeCount: target.proposedEdgeCount,
          createdAt: target.createdAt, updatedAt: target.createdAt,
        }])),
      http.post(`${API_BASE}/api/companion/graph/node/${target.id}/decision`, async () => {
        await gate.promise
        return new HttpResponse(null, { status: 500 })
      }),
    )
    const { result } = renderHook(() => useRoladInbox(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.lifeEvents.length).toBeGreaterThan(0))

    result.current.decideLifeEvent(target, 'accept')

    await waitFor(() => expect(result.current.settled.map((s) => s.id)).toContain(target.id))
    expect(result.current.lifeEvents.map((c) => c.id)).not.toContain(target.id)
    gate.resolve()
    await waitFor(() => expect(result.current.settled.map((s) => s.id)).not.toContain(target.id))
    expect(result.current.lifeEvents.map((c) => c.id)).toContain(target.id)
  })
})
