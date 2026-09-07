import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { replyPatternStub } from '@/test/msw/handlers'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useObservations, useObservationReply } from '@/data/insights/observationsHooks'
import { observations as mockObservations } from '@/data/insights/observations'

const OBS = `${API_BASE}/api/companion/observation`

describe('useObservations (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('serves the four seeded cards synchronously — one per card kind', () => {
    const { result } = renderHook(() => useObservations(), { wrapper: makeHookWrapper() })
    expect(result.current.observations).toHaveLength(4)
    expect(result.current.observations.map((o) => o.card)).toEqual([
      'fresh', 'return', 'watching', 'confirmed',
    ])
    expect(result.current.degraded).toBe(false)
    expect(mockObservations).toHaveLength(4)
  })

  test('reply writes the choice into the cached card without a request', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ read: useObservations(), actions: useObservationReply() }),
      { wrapper },
    )
    const target = mockObservations[0]

    await act(async () => { await result.current.actions.reply(target.patternId, 'watch') })

    await waitFor(() =>
      expect(result.current.read.observations.find((o) => o.id === target.id)?.repliedChoice).toBe('watch'),
    )
  })

  test('the talk branch hands back a mock conversation id to navigate to', async () => {
    const wrapper = makeHookWrapper()
    const { result } = renderHook(() => useObservationReply(), { wrapper })
    let out: { conversationId?: string } | undefined
    await act(async () => { out = await result.current.reply(mockObservations[0].patternId, 'talk') })
    expect(out?.conversationId).toBe('mock-conv')
  })
})

describe('useObservations (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('maps the wire rows: card kind and the i- prefixed clay icon', async () => {
    server.use(
      http.get(OBS, () =>
        HttpResponse.json([
          {
            id: 'e1', patternId: 'p1', hypothesisKey: 'ref-anna-alvas', card: 'fresh',
            occurredAt: '2026-09-07T14:12:00Z', title: 'Anna és az alvásod',
            text: 'Amikor Anna szerepel a naplódban, másnap többet alszol.',
            question: 'Figyeljem tovább?', evidence: ['4 hála-bejegyzés'],
            status: 'proposed', evidenceHits: 4, evidenceMisses: 0, minN: 8,
            belief: 0.4, repliedChoice: null, sourceIcon: 'naplo',
          },
          {
            id: 'p2', patternId: 'p2', hypothesisKey: 'pair:dinner-sleep', card: 'watching',
            occurredAt: '2026-09-07T02:40:00Z', title: 'Késői vacsora → rosszabb alvás',
            text: '', question: null, evidence: [],
            status: 'monitoring', evidenceHits: 4, evidenceMisses: 1, minN: 8,
            belief: 0.62, repliedChoice: 'watch', sourceIcon: 'nincs-ilyen',
          },
        ]),
      ),
    )
    const { result } = renderHook(() => useObservations(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.observations).toHaveLength(2))
    expect(result.current.observations[0].card).toBe('fresh')
    expect(result.current.observations[0].sourceIcon).toBe('i-naplo')
    expect(result.current.observations[0].question).toBe('Figyeljem tovább?')
    // unknown wire icon falls back to the Mezo mark, never to undefined
    expect(result.current.observations[1].sourceIcon).toBe('i-mezo')
    expect(result.current.observations[1].question).toBeUndefined()
    expect(result.current.observations[1].repliedChoice).toBe('watch')
    expect(result.current.degraded).toBe(false)
  })

  test('a 404 (companion switched off) is degraded, not an error', async () => {
    server.use(http.get(OBS, () => HttpResponse.json([{ code: 'NOT_FOUND' }], { status: 404 })))
    const { result } = renderHook(() => useObservations(), { wrapper: makeHookWrapper() })

    await waitFor(() => expect(result.current.degraded).toBe(true))
    expect(result.current.observations).toEqual([])
    expect(result.current.isError).toBe(false)
  })

  test('reply POSTs the choice and refetches the feed', async () => {
    const bodies: unknown[] = []
    let listCalls = 0
    server.use(
      http.get(OBS, () => { listCalls += 1; return HttpResponse.json([]) }),
      http.post(`${API_BASE}/api/companion/pattern/:id/reply`, async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ pattern: replyPatternStub('p1'), conversationId: null })
      }),
    )
    const wrapper = makeHookWrapper()
    const { result } = renderHook(
      () => ({ read: useObservations(), actions: useObservationReply() }),
      { wrapper },
    )
    await waitFor(() => expect(listCalls).toBe(1))

    await act(async () => { await result.current.actions.reply('p1', 'watch') })

    expect(bodies).toEqual([{ choice: 'watch' }])
    await waitFor(() => expect(listCalls).toBeGreaterThan(1))
  })

  test('the talk branch returns the conversation the backend seeded', async () => {
    server.use(
      http.post(`${API_BASE}/api/companion/pattern/:id/reply`, () =>
        HttpResponse.json({ pattern: replyPatternStub('p1'), conversationId: 'conv-42' }),
      ),
    )
    const { result } = renderHook(() => useObservationReply(), { wrapper: makeHookWrapper() })
    let out: { conversationId?: string } | undefined
    await act(async () => { out = await result.current.reply('p1', 'talk', 'mesélj róla') })
    expect(out?.conversationId).toBe('conv-42')
  })
})
