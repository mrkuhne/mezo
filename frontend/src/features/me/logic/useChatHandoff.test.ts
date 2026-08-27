// Weekly review (mezo-p2tr) — the week/day "Beszélgess róla" handoff. Mock mode seeds the
// conversations + thread caches with a canned Mezo opening (the sendMock idiom,
// chatHooks.ts:181-220); real mode posts the anchor context and lets the backend generate the
// opening turn (the round-trip the `pending` flag covers).
import { renderHook, waitFor, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { onToast, type ToastMessage } from '@/shared/lib/toastBus'
import { useChatHandoff } from '@/features/me/logic/useChatHandoff'
import { chatKey, CONVERSATIONS_KEY } from '@/data/insights/chatHooks'
import type { ChatBootstrap, ChatConversations } from '@/data/insights/chatHooks'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

afterEach(() => {
  vi.unstubAllEnvs()
  mockNavigate.mockReset()
})

describe('useChatHandoff (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))

  it('seeds a new conversation + a canned Mezo opening, then navigates to it', () => {
    const { client, wrapper } = makeWrapper()
    const { result } = renderHook(() => useChatHandoff(), { wrapper })

    act(() => result.current.open({ kind: 'day', date: '2026-08-24' }))

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    const url = mockNavigate.mock.calls[0][0] as string
    expect(url).toMatch(/^\/insights\/chat\?c=.+/)
    const id = url.split('c=')[1]

    const conversations = client.getQueryData<ChatConversations>(CONVERSATIONS_KEY)
    expect(conversations?.conversations[0].id).toBe(id)

    const thread = client.getQueryData<ChatBootstrap>(chatKey(id))
    expect(thread?.conversationId).toBe(id)
    expect(thread?.messages).toHaveLength(1)
    expect(thread?.messages[0].role).toBe('assistant')
    expect(thread?.messages[0].text.length).toBeGreaterThan(0)
    expect(result.current.pending).toBe(false)
  })

  it('week handoff seeds a week-flavoured opening', () => {
    const { client, wrapper } = makeWrapper()
    const { result } = renderHook(() => useChatHandoff(), { wrapper })

    act(() => result.current.open({ kind: 'week', date: '2026-08-24' }))

    const url = mockNavigate.mock.calls[0][0] as string
    const id = url.split('c=')[1]
    const thread = client.getQueryData<ChatBootstrap>(chatKey(id))
    expect(thread?.messages[0].role).toBe('assistant')
  })
})

describe('useChatHandoff (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))

  it('posts the context body, navigates on 200, and pending is true during flight', async () => {
    let body: unknown
    let resolveRequest: () => void = () => {}
    const gate = new Promise<void>((resolve) => { resolveRequest = resolve })
    server.use(
      http.post(`${API_BASE}/api/companion/conversation`, async ({ request }) => {
        body = await request.json()
        await gate
        return HttpResponse.json(
          { id: 'c-anchored', title: null, startedAt: '2026-08-24T06:00:00Z', lastMessageAt: null },
          { status: 200 },
        )
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useChatHandoff(), { wrapper })

    act(() => result.current.open({ kind: 'week', date: '2026-08-24' }))
    await waitFor(() => expect(result.current.pending).toBe(true))
    expect(mockNavigate).not.toHaveBeenCalled()

    resolveRequest()
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(mockNavigate).toHaveBeenCalledWith('/insights/chat?c=c-anchored')
    expect(body).toEqual({ context: { kind: 'week', date: '2026-08-24' } })
  })

  it('ignores a second open() while the first create is still in flight (fix round 1)', async () => {
    let requestCount = 0
    let resolveRequest: () => void = () => {}
    const gate = new Promise<void>((resolve) => { resolveRequest = resolve })
    server.use(
      http.post(`${API_BASE}/api/companion/conversation`, async () => {
        requestCount += 1
        await gate
        return HttpResponse.json(
          { id: 'c-anchored', title: null, startedAt: '2026-08-24T06:00:00Z', lastMessageAt: null },
          { status: 200 },
        )
      }),
    )
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useChatHandoff(), { wrapper })

    act(() => result.current.open({ kind: 'week', date: '2026-08-24' }))
    await waitFor(() => expect(result.current.pending).toBe(true))

    // A double-click (or two triggering buttons) while the first POST is still in flight —
    // the re-entrancy guard in open() must swallow this, not fire a second request.
    act(() => result.current.open({ kind: 'day', date: '2026-08-25' }))
    act(() => result.current.open({ kind: 'week', date: '2026-08-24' }))

    resolveRequest()
    await waitFor(() => expect(result.current.pending).toBe(false))

    expect(requestCount).toBe(1)
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('shows a toast and does not navigate on failure', async () => {
    server.use(
      http.post(`${API_BASE}/api/companion/conversation`, () =>
        HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'boom' }], { status: 500 })),
    )
    const toasts: ToastMessage[] = []
    const unsubscribe = onToast((t) => toasts.push(t))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useChatHandoff(), { wrapper })

    act(() => result.current.open({ kind: 'day', date: '2026-08-24' }))
    await waitFor(() => expect(result.current.pending).toBe(false))

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(toasts).toEqual([{ kind: 'error', text: 'Nem sikerült elindítani a beszélgetést' }])
    unsubscribe()
  })
})
