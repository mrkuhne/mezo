import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, expect, test, vi } from 'vitest'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { makeHookWrapper } from '@/test/queryWrapper'
import { useCharacterReplies, useCharacterReplyDraft } from '@/data/character/characterReplyHooks'
const source = {
  sourceType: 'OBSERVATION' as const,
  sourceId: '00000000-0000-0000-0000-000000000001',
  sourceIndex: 0,
}
afterEach(() => vi.unstubAllEnvs())
test('real reply stays saved when evaluation failed and retry updates the same record', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  const reply = {
    ...source,
    id: 'reply-1',
    sourceText: 'Eredeti',
    text: 'Pontosítás',
    createdAt: '2026-09-20T10:00:00Z',
    authorName: 'Te',
    status: 'FAILED',
  }
  const received: unknown[] = []
  server.use(
    http.get(`${API_BASE}/api/character/replies`, () => HttpResponse.json([])),
    http.post(`${API_BASE}/api/character/replies`, async ({ request }) => {
      received.push(await request.json())
      return HttpResponse.json(reply)
    }),
    http.post(`${API_BASE}/api/character/replies/reply-1/retry`, () =>
      HttpResponse.json({
        ...reply,
        status: 'COMPLETED',
        outcome: 'UNCHANGED',
        outcomeText: 'Az állítás változatlan.',
      }),
    ),
  )
  const { result } = renderHook(() => useCharacterReplies(source), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isLoading).toBe(false))
  await act(async () => {
    await result.current.send('Pontosítás', '00000000-0000-0000-0000-000000000002')
  })
  expect(received).toEqual([
    { ...source, text: 'Pontosítás', clientRequestId: '00000000-0000-0000-0000-000000000002' },
  ])
  await waitFor(() => expect(result.current.replies[0]?.status).toBe('FAILED'))
  await act(async () => {
    await result.current.retry('reply-1')
  })
  expect(result.current.replies).toHaveLength(1)
  await waitFor(() => expect(result.current.replies[0]?.outcomeText).toBe('Az állítás változatlan.'))
})
test('real failed reads never display a mock conversation', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  server.use(http.get(`${API_BASE}/api/character/replies`, () => new HttpResponse(null, { status: 503 })))
  const { result } = renderHook(() => useCharacterReplies(source), { wrapper: makeHookWrapper() })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.replies).toEqual([])
})

test('a read started before saving cannot erase the saved reply', async () => {
  vi.stubEnv('VITE_USE_MOCK', 'false')
  let release: (() => void) | undefined
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  let stored = false
  const reply = {
    ...source,
    id: 'new',
    sourceText: 'Eredeti',
    text: 'Saját közlés',
    createdAt: '2026-09-20T10:00:00Z',
    authorName: 'Te',
    status: 'SAVED',
  }
  server.use(
    http.get(`${API_BASE}/api/character/replies`, async () => {
      const snapshot = stored ? [reply] : []
      await waiting
      return HttpResponse.json(snapshot)
    }),
    http.post(`${API_BASE}/api/character/replies`, () => {
      stored = true
      return HttpResponse.json(reply)
    }),
  )
  const { result } = renderHook(() => useCharacterReplies(source), { wrapper: makeHookWrapper() })
  await act(async () => {
    await result.current.send('Saját közlés', 'request')
  })
  await act(async () => {
    release?.()
  })
  await waitFor(() => expect(result.current.replies[0]?.id).toBe('new'))
})

test('source-scoped drafts retain uncertain-save request IDs across remounts', () => {
  const wrapper = makeHookWrapper()
  const first = renderHook(() => useCharacterReplyDraft(source), { wrapper })
  act(() => first.result.current.setDraft('Pontosítom ezt.'))
  let id = ''
  act(() => {
    id = first.result.current.requestId()
  })
  first.unmount()
  const next = renderHook(() => useCharacterReplyDraft(source), { wrapper })
  expect(next.result.current.draft).toBe('Pontosítom ezt.')
  expect(next.result.current.requestId()).toBe(id)
})

test('a late successful send cannot erase a newer draft from a remounted thread', () => {
  const { result } = renderHook(() => useCharacterReplyDraft(source), { wrapper: makeHookWrapper() })
  act(() => result.current.setDraft('Első válasz'))
  let firstId = ''
  act(() => {
    firstId = result.current.requestId()
  })
  act(() => result.current.setDraft('Újabb piszkozat'))
  act(() => result.current.clearDraft(firstId))
  expect(result.current.draft).toBe('Újabb piszkozat')
})
