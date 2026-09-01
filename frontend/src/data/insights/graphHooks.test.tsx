import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import {
  useLifeEventCandidates, useKnowledgeGraphNodes, useKnowledgeGraphActions, useLifeEventActions,
  useGraphEdgeCount,
} from '@/data/insights/graphHooks'
import { lifeEventCandidateSeed, graphNodeSeed, graphNodeSeedByUpdatedAt } from '@/data/insights/graph'
import { edges as edgeSeed } from '@/data/insights/knowledge'

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

  it('mock módban a seed csomópontokat adja vissza, updatedAt szerint csökkenő sorrendben', async () => {
    const { result } = renderHook(() => useKnowledgeGraphNodes(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.nodes.length).toBeGreaterThan(0))
    // a seed maga NEM ebben a sorrendben van felsorolva — csak a tényleges rendezés bukná ezt.
    expect(result.current.nodes).toEqual(graphNodeSeedByUpdatedAt)
    expect(result.current.nodes.map((n) => n.id)).not.toEqual(graphNodeSeed.map((n) => n.id))
    const timestamps = result.current.nodes.map((n) => n.updatedAt)
    expect(timestamps).toEqual([...timestamps].sort().reverse())
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

describe('useGraphEdgeCount', () => {
  it('mock módban a seed-élszámot adja vissza', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const { result } = renderHook(() => useGraphEdgeCount(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.count).toBe(edgeSeed.length))
    vi.unstubAllEnvs()
  })

  it('real módban a GET /graph/edge/count választ adja vissza', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/companion/graph/edge/count`, () => HttpResponse.json({ count: 7 })),
    )
    const { result } = renderHook(() => useGraphEdgeCount(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.count).toBe(7))
    vi.unstubAllEnvs()
  })

  it('real módban 404-re (gráf-kapcsoló ki) null-t ad, nem hibát', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/companion/graph/edge/count`, () => new HttpResponse(null, { status: 404 })),
    )
    const { result } = renderHook(() => useGraphEdgeCount(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.count).toBe(null))
    vi.unstubAllEnvs()
  })

  it('real módban amíg függőben van, null-t ad (a hero elhagyja a szegmenst, sose 0-t mutat)', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    server.use(
      http.get(`${API_BASE}/api/companion/graph/edge/count`, async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json({ count: 3 })
      }),
    )
    const { result } = renderHook(() => useGraphEdgeCount(), { wrapper: makeHookWrapper() })
    expect(result.current.count).toBe(null)
    await waitFor(() => expect(result.current.count).toBe(3))
    vi.unstubAllEnvs()
  })
})

describe('useLifeEventActions decide (refined accept, mezo-ms9a)', () => {
  it('mock módban elfogadáskor a jelölt lekerül, és a refined cím/összefoglaló kerül a node-cache-be', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'true')
    const wrapper = makeHookWrapper()
    const candidates = renderHook(() => useLifeEventCandidates(), { wrapper })
    const nodes = renderHook(() => useKnowledgeGraphNodes(), { wrapper })
    await waitFor(() => expect(candidates.result.current.candidates.length).toBeGreaterThan(0))
    await waitFor(() => expect(nodes.result.current.nodes.length).toBeGreaterThan(0))

    const actions = renderHook(() => useLifeEventActions(), { wrapper })
    const target = lifeEventCandidateSeed[0]
    actions.result.current.decide(target.id, 'accept', { title: 'Pontosított cím', summary: 'Pontosított összefoglaló' })

    await waitFor(() =>
      expect(candidates.result.current.candidates.map((c) => c.id)).not.toContain(target.id))
    await waitFor(() => {
      const promoted = nodes.result.current.nodes.find((n) => n.id === target.id)
      expect(promoted).toMatchObject({ title: 'Pontosított cím', summary: 'Pontosított összefoglaló' })
    })
    vi.unstubAllEnvs()
  })

  it('real módban a refinedTitle/refinedSummary megy a decision body-ba', async () => {
    vi.stubEnv('VITE_USE_MOCK', 'false')
    let sentBody: unknown
    server.use(
      http.post(`${API_BASE}/api/companion/graph/node/n1/decision`, async ({ request }) => {
        sentBody = await request.json()
        return HttpResponse.json({
          id: 'n1', kind: 'LIFE_EVENT', title: 'Pontosított cím', status: 'active',
          createdAt: '2026-08-22T02:00:00Z', updatedAt: '2026-08-22T02:00:00Z', proposedEdgeCount: 0,
        })
      }),
    )
    const { result } = renderHook(() => useLifeEventActions(), { wrapper: makeHookWrapper() })
    result.current.decide('n1', 'accept', { title: 'Pontosított cím', summary: 'Pontosított összefoglaló' })
    await waitFor(() => expect(sentBody).toEqual({
      decision: 'accept', refinedTitle: 'Pontosított cím', refinedSummary: 'Pontosított összefoglaló',
    }))
    vi.unstubAllEnvs()
  })
})
