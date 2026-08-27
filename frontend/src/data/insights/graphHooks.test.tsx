import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useLifeEventCandidates, useKnowledgeGraphNodes, useKnowledgeGraphActions } from '@/data/insights/graphHooks'
import { lifeEventCandidateSeed, graphNodeSeed } from '@/data/insights/graph'

describe('useLifeEventCandidates (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('mock módban a seed jelölteket adja vissza', async () => {
    const { result } = renderHook(() => useLifeEventCandidates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0))
    expect(result.current.candidates).toEqual(lifeEventCandidateSeed)
    expect(result.current.candidates[0].title).toBeTruthy()
  })
})

describe('useLifeEventCandidates (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('real módban a 404-et (gráf-kapcsoló ki) üres listaként olvassa, nem hibaként', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useLifeEventCandidates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.candidates).toEqual([])
    expect(result.current.isError).toBe(false)
  })

  it('real módban a wire választ FE alakra képezi', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely', summary: 'Első hét.',
            status: 'candidate', occurredOn: '2026-08-21', proposedEdgeCount: 2,
            createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
          },
        ])),
    )
    const { result } = renderHook(() => useLifeEventCandidates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates.length).toBe(1))
    expect(result.current.candidates[0]).toMatchObject({
      id: 'n1', title: 'Új munkahely', occurredOn: '2026-08-21', proposedEdgeCount: 2,
    })
  })

  it('a jelölt kind-ját átviszi a domain típusra (W5.3 szezon-jelöltek)', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node/candidate`, () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'LIFE_EVENT', title: 'Új munkahely', summary: 'Első hét.',
            status: 'candidate', occurredOn: '2026-08-21', proposedEdgeCount: 1,
            createdAt: '2026-08-22T03:20:00Z', updatedAt: '2026-08-22T03:20:00Z',
          },
          {
            id: 'n2', kind: 'SEASON', title: 'Nyári alapozás', summary: 'A nyár a volumenről szólt.',
            status: 'candidate', occurredOn: '2026-07-01', proposedEdgeCount: 0,
            createdAt: '2026-10-01T04:00:00Z', updatedAt: '2026-10-01T04:00:00Z',
          },
        ])),
    )
    const { result } = renderHook(() => useLifeEventCandidates(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.candidates).toHaveLength(2))
    expect(result.current.candidates.map((c) => c.kind)).toEqual(['LIFE_EVENT', 'SEASON'])
  })
})

describe('useKnowledgeGraphNodes (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('mock módban a seed csomópontokat adja vissza', async () => {
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.nodes.length).toBeGreaterThan(0))
    expect(result.current.nodes).toEqual(graphNodeSeed)
  })
})

describe('useKnowledgeGraphNodes (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('real módban a 404-et (gráf-kapcsoló ki) üres listaként olvassa, nem hibaként', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.nodes).toEqual([])
    expect(result.current.isError).toBe(false)
  })

  it('real módban a wire választ FE alakra képezi, topEdges-szel', async () => {
    server.use(
      http.get(`${API_BASE}/api/companion/graph/node`, () =>
        HttpResponse.json([
          {
            id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást', summary: null,
            status: 'active', createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z',
            proposedEdgeCount: 0, topEdges: ['Késői evés → kiváltja → Rossz alvás · erős'],
          },
        ])),
    )
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.nodes.length).toBe(1))
    expect(result.current.nodes[0]).toMatchObject({
      id: 'n1', kind: 'PATTERN', title: 'Késői evés rontja az alvást',
      topEdges: ['Késői evés → kiváltja → Rossz alvás · erős'],
    })
  })
})

describe('useKnowledgeGraphActions (archive)', () => {
  it('mock módban archiváláskor lekerül a csomópont a listáról', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const wrapper = makeHookWrapper()
    const nodes = renderHook(() => useKnowledgeGraphNodes(), { wrapper })
    await waitFor(() => expect(nodes.result.current.nodes.length).toBeGreaterThan(0))

    const actions = renderHook(() => useKnowledgeGraphActions(), { wrapper })
    actions.result.current.archive(graphNodeSeed[0].id)

    await waitFor(() => expect(nodes.result.current.nodes.map((n) => n.id)).not.toContain(graphNodeSeed[0].id))
    vi.unstubAllEnvs()
  })

  it('real módban POST-ol az archive végpontra', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let called = false
    server.use(
      http.post(`${API_BASE}/api/companion/graph/node/n1/archive`, () => {
        called = true
        return HttpResponse.json({
          id: 'n1', kind: 'PATTERN', title: 'x', status: 'archived',
          createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z', proposedEdgeCount: 0,
        })
      }),
    )
    const { result } = renderHook(() => useKnowledgeGraphActions(), { wrapper: makeHookWrapper() })
    result.current.archive('n1')
    await waitFor(() => expect(called).toBe(true))
    vi.unstubAllEnvs()
  })
})
