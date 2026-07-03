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
    expect(assistant.tools).toEqual([{ type: 'read', name: 'get_sleep(days=3)' }])
    expect(assistant.refs).toEqual([{ kind: 'Sleep', id: '2026-07-02' }])
  })
})
