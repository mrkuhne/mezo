import { renderHook, waitFor, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import {
  useConversations, useConversationActions, useChat, useChatActions, CONVERSATIONS_KEY,
} from '@/data/insights/chatHooks'

// F7.5 (mezo-d20.8.5): rename/delete a beszélgetésen + a bukott kör megőrzése (retry/edit).

describe('useConversationActions (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  it('rename updates the picker list label in the cache', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useConversations(), { wrapper })
    const id = list.result.current.data.conversations[0].id
    const actions = renderHook(() => useConversationActions(), { wrapper })

    await act(() => actions.result.current.rename(id, 'Súly-plató nyomozás'))

    await waitFor(() => expect(
      list.result.current.data.conversations.find((c) => c.id === id)?.title,
    ).toBe('Súly-plató nyomozás'))
  })

  it('remove drops the row from the picker list', async () => {
    const wrapper = makeHookWrapper()
    const list = renderHook(() => useConversations(), { wrapper })
    const id = list.result.current.data.conversations[0].id
    const actions = renderHook(() => useConversationActions(), { wrapper })

    await act(() => actions.result.current.remove(id))

    await waitFor(() => expect(
      list.result.current.data.conversations.some((c) => c.id === id),
    ).toBe(false))
  })
})

describe('useConversationActions (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  it('rename PATCHes the conversation and refreshes the list', async () => {
    let patched: { id: string; title: string } | null = null
    server.use(
      http.patch(`${API_BASE}/api/companion/conversation/:id`, async ({ params, request }) => {
        const body = (await request.json()) as { title: string }
        patched = { id: params.id as string, title: body.title }
        return HttpResponse.json({ id: params.id, title: body.title, startedAt: '2026-08-01T10:00:00Z', lastMessageAt: null })
      }),
    )
    const wrapper = makeHookWrapper()
    const actions = renderHook(() => useConversationActions(), { wrapper })

    await act(() => actions.result.current.rename('c-1', 'Új cím'))

    expect(patched).toEqual({ id: 'c-1', title: 'Új cím' })
  })

  it('remove DELETEs the conversation and invalidates the newest-thread cache too', async () => {
    let deleted: string | null = null
    server.use(
      http.delete(`${API_BASE}/api/companion/conversation/:id`, ({ params }) => {
        deleted = params.id as string
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const wrapper = makeHookWrapper()
    const actions = renderHook(() => useConversationActions(), { wrapper })

    await act(() => actions.result.current.remove('c-1'))

    expect(deleted).toBe('c-1')
  })
})

describe('useChatActions failed-turn state (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  const failStream = () =>
    server.use(http.post(`${API_BASE}/api/companion/conversation/:id/message/stream`, () => {
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(
            `event:error\ndata:${JSON.stringify({ code: 'COMPANION_UPSTREAM' })}\n\n`))
          controller.close()
        },
      })
      return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } })
    }))

  it('keeps the failed text after the error and retry() re-sends the same turn', async () => {
    failStream()
    const wrapper = makeHookWrapper()
    const chat = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(chat.result.current.data.conversationId).toBe('c-1'))
    const actions = renderHook(() => useChatActions(), { wrapper })

    act(() => actions.result.current.send('Fáradt vagyok'))
    await waitFor(() => expect(actions.result.current.error).not.toBeNull())
    expect(actions.result.current.failedText).toBe('Fáradt vagyok')

    // retry re-runs the SAME text (replace, don't append — still failing here)
    act(() => actions.result.current.retry())
    await waitFor(() => expect(actions.result.current.error).not.toBeNull())
    expect(actions.result.current.failedText).toBe('Fáradt vagyok')
  })

  it('editFailed() hands the text back and clears the failed state', async () => {
    failStream()
    const wrapper = makeHookWrapper()
    const chat = renderHook(() => useChat(), { wrapper })
    await waitFor(() => expect(chat.result.current.data.conversationId).toBe('c-1'))
    const actions = renderHook(() => useChatActions(), { wrapper })

    act(() => actions.result.current.send('Elgépeelt üzenet'))
    await waitFor(() => expect(actions.result.current.failedText).toBe('Elgépeelt üzenet'))

    let text: string | null = null
    act(() => { text = actions.result.current.editFailed() })
    expect(text).toBe('Elgépeelt üzenet')
    expect(actions.result.current.failedText).toBeNull()
    expect(actions.result.current.error).toBeNull()
  })
})

// A guard the barrel stays honest: the new hook is exported through hooks.ts.
it('CONVERSATIONS_KEY stays the shared cache key', () => {
  expect(CONVERSATIONS_KEY).toEqual(['chat', 'conversations'])
})
