import { renderHook, waitFor } from '@testing-library/react'
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
})
