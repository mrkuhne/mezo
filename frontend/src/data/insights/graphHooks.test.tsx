import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useLifeEventCandidates } from '@/data/insights/graphHooks'
import { lifeEventCandidateSeed } from '@/data/insights/graph'

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
})
