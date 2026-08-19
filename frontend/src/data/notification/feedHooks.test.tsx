import { renderHook, waitFor, act } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { useNotificationFeed, useNotificationFeedActions } from '@/data/notification/feedHooks'
import { notificationFeedSeed } from '@/data/notification/feedMock'
import { isMockMode } from '@/data/_client/mode'
import { API_BASE } from '@/data/_client/api'
import { makeHookWrapper } from '@/test/queryWrapper'
import { server } from '@/test/msw/server'

describe('useNotificationFeed', () => {
  it('serves the 6-item seed with 3 unread', async () => {
    server.use(http.get(`${API_BASE}/api/notification/feed`, () =>
      HttpResponse.json({ items: notificationFeedSeed })))
    const { result } = renderHook(() => useNotificationFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(6))
    expect(result.current.items.filter((n) => !n.readAt)).toHaveLength(3)
  })

  it('mock mode never reaches the network', async () => {
    if (!isMockMode()) return
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { result } = renderHook(() => useNotificationFeed(), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.items).toHaveLength(6))
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('markAllRead optimistically stamps every unread row (both modes)', async () => {
    let state = notificationFeedSeed.map((n) => ({ ...n }))
    server.use(
      http.get(`${API_BASE}/api/notification/feed`, () => HttpResponse.json({ items: state })),
      http.post(`${API_BASE}/api/notification/feed/read-all`, () => {
        state = state.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(
      () => ({ feed: useNotificationFeed(), actions: useNotificationFeedActions() }),
      { wrapper: makeHookWrapper() },
    )
    await waitFor(() => expect(result.current.feed.items).toHaveLength(6))

    await act(async () => { await result.current.actions.markAllRead() })

    await waitFor(() => expect(result.current.feed.items.filter((n) => !n.readAt)).toHaveLength(0))
  })

  it('real mode: a failed read-all rolls the optimistic stamp back', async () => {
    if (isMockMode()) return
    server.use(
      http.get(`${API_BASE}/api/notification/feed`, () =>
        HttpResponse.json({ items: notificationFeedSeed })),
      http.post(`${API_BASE}/api/notification/feed/read-all`, () =>
        new HttpResponse(null, { status: 500 })),
    )
    const { result } = renderHook(
      () => ({ feed: useNotificationFeed(), actions: useNotificationFeedActions() }),
      { wrapper: makeHookWrapper() },
    )
    await waitFor(() => expect(result.current.feed.items).toHaveLength(6))

    await act(async () => { await result.current.actions.markAllRead().catch(() => {}) })

    await waitFor(() => expect(result.current.feed.items.filter((n) => !n.readAt)).toHaveLength(3))
  })
})
