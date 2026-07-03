import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useKnowledge, useKnowledgeActions } from '@/data/insights/knowledgeHooks'
import { facts as knowledgeSeed, candidateSeed, edges } from '@/data/insights/knowledge'

describe('useKnowledge (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds facts, candidates and edges synchronously', () => {
    const { result } = renderHook(() => useKnowledge(), { wrapper: makeHookWrapper() })
    expect(result.current.facts).toEqual(knowledgeSeed)
    expect(result.current.candidates).toEqual(candidateSeed)
    expect(result.current.edges).toEqual(edges)
    expect(result.current.activeCount).toBe(14)
    expect(result.current.mode).toBe('mock')
  })
})

describe('useKnowledge (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('fetches facts + candidates; edges stay an honest empty array', async () => {
    const { result } = renderHook(() => useKnowledge(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.facts).toHaveLength(15))
    expect(result.current.candidates).toEqual(candidateSeed)
    expect(result.current.edges).toEqual([])
    expect(result.current.mode).toBe('live')
    expect(result.current.degraded).toBe(false)
  })

  it('maps the switch-off 404 to an honest degraded state', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/fact`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND' }], { status: 404 })),
    )
    const { result } = renderHook(() => useKnowledge(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.facts).toEqual([])
  })
})

describe('useKnowledgeActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('toggle flips the fact in the shared cache', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useKnowledge(), actions: useKnowledgeActions() }), { wrapper })
    act(() => result.current.actions.toggle('f1', false))
    await waitFor(() =>
      expect(result.current.read.facts.find((f) => f.id === 'f1')?.active).toBe(false))
    expect(result.current.read.activeCount).toBe(13)
  })

  it('accept promotes the candidate into the fact list', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useKnowledge(), actions: useKnowledgeActions() }), { wrapper })
    act(() => result.current.actions.decide('c1', 'accept'))
    await waitFor(() => expect(result.current.read.candidates).toHaveLength(1))
    const promoted = result.current.read.facts.find((f) => f.id === 'kf-c1')
    expect(promoted).toMatchObject({ text: candidateSeed[0].text, category: 'fuel', active: true, reinforced: 0 })
  })

  it('refine promotes with the corrected wording; reject only removes', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useKnowledge(), actions: useKnowledgeActions() }), { wrapper })
    act(() => result.current.actions.decide('c1', 'refine', 'Pontosított tudás'))
    await waitFor(() => expect(result.current.read.facts.find((f) => f.id === 'kf-c1')?.text).toBe('Pontosított tudás'))
    act(() => result.current.actions.decide('c2', 'reject'))
    await waitFor(() => expect(result.current.read.candidates).toHaveLength(0))
    expect(result.current.read.facts.find((f) => f.id === 'kf-c2')).toBeUndefined()
  })
})

describe('useKnowledgeActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('toggle PATCHes then invalidates the knowledge bootstrap', async () => {
    let patched = 0
    server.use(
      http.patch(`${API_BASE}/api/companion/fact/f1`, () => {
        patched++
        return HttpResponse.json({
          id: 'f1', factText: 'x', category: 'train', source: 'manual',
          reinforcementCount: 1, includeInPrompt: false, lastReinforcedAt: null,
          createdAt: '2026-07-03T06:00:00Z',
        })
      }),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useKnowledge(), actions: useKnowledgeActions() }), { wrapper })
    await waitFor(() => expect(result.current.read.facts).toHaveLength(15))
    act(() => result.current.actions.toggle('f1', false))
    await waitFor(() => expect(patched).toBe(1))
  })

  it('decide POSTs; the invalidated refetch drops the decided candidate', async () => {
    let posted = 0
    server.use(
      http.post(`${API_BASE}/api/companion/fact/candidate/c1/decision`, () => {
        posted++
        return HttpResponse.json({
          id: 'c1', candidateText: 'x', category: 'fuel', userDecision: 'accept',
          refinedText: null, promotedFactId: 'kf-c1', createdAt: '2026-07-03T06:00:00Z',
        })
      }),
      // after the decision the refetch no longer returns c1
      http.get(`${API_BASE}/api/companion/fact/candidate`, () =>
        HttpResponse.json([])),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => ({ read: useKnowledge(), actions: useKnowledgeActions() }), { wrapper })
    await waitFor(() => expect(result.current.read.facts).toHaveLength(15))
    act(() => result.current.actions.decide('c1', 'accept'))
    await waitFor(() => expect(posted).toBe(1))
    await waitFor(() => expect(result.current.read.candidates).toHaveLength(0))
  })
})
