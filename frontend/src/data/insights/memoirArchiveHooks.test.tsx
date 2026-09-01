import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useMemoirArchive } from '@/data/insights/memoirHooks'
import { memoirArchive } from '@/data/insights/insights'

describe('useMemoirArchive (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds the archive synchronously, newest week first, bodies multi-paragraph', () => {
    const { result } = renderHook(() => useMemoirArchive(), { wrapper: makeHookWrapper() })
    expect(result.current.data.length).toBeGreaterThanOrEqual(6)
    const weeks = result.current.data.map((e) => e.weekStart)
    expect([...weeks].sort().reverse()).toEqual(weeks)
    expect(result.current.data[0].body).toContain('\n\n')
  })
})

describe('useMemoirArchive (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('maps the wire entries and derives the week label client-side', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/memoir/archive`, () => HttpResponse.json({
      entries: [{
        id: 'aa1', weekStart: '2026-08-24', title: 'A mérleg-hét', body: 'x\n\ny',
        anchors: [{ kind: 'Sleep', label: '6,2 h átlag' }], generatedAt: '2026-08-30T18:00:00Z',
      }],
    })))
    const { result } = renderHook(() => useMemoirArchive(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data[0]).toMatchObject({
      id: 'aa1', weekStart: '2026-08-24', title: 'A mérleg-hét',
    })
    expect(result.current.data[0].week).toMatch(/^Hét 35/)
  })

  it('a switch-off 404 resolves to the honest empty archive', async () => {
    server.use(http.get(`${API_BASE}/api/proactive/memoir/archive`, () =>
      new HttpResponse(null, { status: 404 })))
    const { result } = renderHook(() => useMemoirArchive(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toEqual([])
  })
})

it('the mock archive seed carries anchors and 3 months of story', () => {
  expect(new Set(memoirArchive.map((e) => e.weekStart.slice(0, 7))).size).toBeGreaterThanOrEqual(3)
  expect(memoirArchive.every((e) => e.anchors.length > 0)).toBe(true)
})
