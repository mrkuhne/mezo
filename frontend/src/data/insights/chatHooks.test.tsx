import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useChat, useChatActions } from '@/data/insights/chatHooks'
import { initialChat, cannedReply } from '@/data/insights/chat'

describe('useChat (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('seeds the Phase-1 conversation synchronously', () => {
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    expect(result.current.data.messages).toEqual(initialChat)
    expect(result.current.data.mode).toBe('mock')
    expect(result.current.data.degraded).toBe(false)
  })
})

describe('useChat (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('loads the newest conversation and maps its messages', async () => {
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.conversationId).toBe('c-1'))
    expect(result.current.data.mode).toBe('live')
    expect(result.current.data.messages[0].text).toBe(initialChat[0].text)
    expect(result.current.data.messages[0].tools).toEqual(initialChat[0].tools)
  })

  it('resolves an empty account to an empty, non-degraded chat', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () => HttpResponse.json([])))
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.data).toMatchObject({ conversationId: null, messages: [], degraded: false })
  })

  it('maps the switch-off 404 to an honest degraded state', async () => {
    server.use(http.get(`${API_BASE}/api/companion/conversation`, () =>
      HttpResponse.json([{ code: 'RESOURCE_NOT_FOUND', message: 'off' }], { status: 404 })))
    const { result } = renderHook(() => useChat(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.data.degraded).toBe(true))
  })
})

describe('useChatActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('streams a turn into the chat cache', async () => {
    const wrapper = makeHookWrapper()
    const chat = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(chat.result.current.data.conversationId).toBe('c-1'))

    const actions = renderHook(() => useChatActions(), { wrapper })
    act(() => actions.result.current.send('Fáradt vagyok'))
    await waitFor(() => expect(actions.result.current.turn).toBeNull())

    const texts = chat.result.current.data.messages.map((m) => m.text)
    expect(texts).toContain('Fáradt vagyok')
    expect(texts).toContain(cannedReply('Fáradt vagyok'))
    expect(actions.result.current.error).toBeNull()

    // V0.5: the persisted done event carries the turn's REAL tool chips + refs
    const assistant = chat.result.current.data.messages.at(-1)!
    expect(assistant.tools).toEqual([{ type: 'read', name: 'get_recovery(days=3)' }])
    expect(assistant.refs).toEqual([{ kind: 'Sleep', id: '2026-07-02' }])
  })

  // mezo-8z79: the backend refuses to persist a blank answer and terminates the stream with
  // COMPANION_EMPTY_ANSWER. That is a different story from a transport failure — nothing was
  // saved either way, but "the model said nothing" is worth an immediate retry, so it gets its
  // own message rather than the generic one.
  it('surfaces the empty-answer stream error with its own message', async () => {
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(
            `event:error\ndata:${JSON.stringify({ code: 'COMPANION_EMPTY_ANSWER' })}\n\n`))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

    const wrapper = makeHookWrapper()
    const chat = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(chat.result.current.data.conversationId).toBe('c-1'))

    const actions = renderHook(() => useChatActions(), { wrapper })
    act(() => actions.result.current.send('Fáradt vagyok'))

    await waitFor(() =>
      expect(actions.result.current.error).toBe('A társ nem adott választ erre a körre — próbáld újra.'))
  })

  // mezo-280: the live 'tool' SSE event accumulates onto the in-flight turn as it streams,
  // ahead of the terminal 'done' row — this is what lets ChatPage show the chip mid-answer.
  // The stream is gated after the 'tool' frame so the test can observe that intermediate
  // state before letting 'delta'/'done' complete the turn — the module handler's frames
  // land within the same microtask flush, too fast for a plain waitFor to ever catch mid-stream.
  it('exposes streamed tools on the in-flight turn before the stream completes', async () => {
    let releaseRest: () => void = () => {}
    const rest = new Promise<void>((resolve) => { releaseRest = resolve })
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, async ({ request }) => {
      const { content } = (await request.json()) as { content: string }
      const reply = cannedReply(content)
      const encoder = new TextEncoder()
      const frame = (event: string, data: unknown) => `event:${event}\ndata:${JSON.stringify(data)}\n\n`
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(encoder.encode(frame('tool', { type: 'read', name: 'get_recovery(days=3)' })))
          await rest
          controller.enqueue(encoder.encode(frame('delta', { text: reply })))
          controller.enqueue(encoder.encode(frame('done', {
            id: 'msg-done', role: 'assistant', content: reply,
            createdAt: '2026-07-03T07:00:05Z',
            tools: [{ type: 'read', name: 'get_recovery(days=3)' }],
            refs: [{ kind: 'Sleep', id: '2026-07-02' }],
            recalled: [],
            degraded: false,
          })))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

    const wrapper = makeHookWrapper()
    const chat = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(chat.result.current.data.conversationId).toBe('c-1'))

    const actions = renderHook(() => useChatActions(), { wrapper })
    act(() => actions.result.current.send('Fáradt vagyok'))

    await waitFor(() =>
      expect(actions.result.current.turn?.tools).toContainEqual({ type: 'read', name: 'get_recovery(days=3)' }))
    expect(actions.result.current.turn?.thinking).toBe(false)

    releaseRest()
    await waitFor(() => expect(actions.result.current.turn).toBeNull())
  })
})
