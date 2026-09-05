import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useMemoryRetrievalFeedback } from '@/data/hooks'
import { API_BASE } from '@/data/_client/api'
import { onToast } from '@/shared/lib/toastBus'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'

const RUN = '11111111-1111-4111-8111-111111111111'
const A = '22222222-2222-4222-8222-222222222222'
const B = '33333333-3333-4333-8333-333333333333'
const AT = '2026-09-05T09:00:00Z'

const wire = (resultId: string, action: 'useful' | 'irrelevant' | 'suppress') => ({
  runId: RUN, resultId, action, updatedAt: AT,
})

describe('useMemoryRetrievalFeedback (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('keeps session-local optimistic feedback without network traffic', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const { result } = renderHook(() => useMemoryRetrievalFeedback([A, B]), {
        wrapper: makeHookWrapper(),
      })
      act(() => result.current.act(RUN, A, 'useful'))
      await waitFor(() => expect(result.current.get(A)?.action).toBe('useful'))
      expect(result.current.get(B)).toBeUndefined()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('useMemoryRetrievalFeedback (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('batch-reads the whole visible result-id set exactly once', async () => {
    const searches: string[] = []
    server.use(http.get(`${API_BASE}/api/companion/memory/retrieval-feedback`, ({ request }) => {
      searches.push(new URL(request.url).search)
      return HttpResponse.json([wire(A, 'useful')])
    }))

    const { result } = renderHook(() => useMemoryRetrievalFeedback([A, B, A]), {
      wrapper: makeHookWrapper(),
    })

    await waitFor(() => expect(result.current.get(A)?.action).toBe('useful'))
    expect(result.current.get(B)).toBeUndefined()
    expect(searches).toEqual([`?resultIds=${A},${B}`])
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
    expect(searches).toHaveLength(1)
  })

  test('requests only the newest 100 unique visible result ids', async () => {
    const ids = Array.from(
      { length: 101 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    )
    let requestedIds: string[] = []
    server.use(http.get(`${API_BASE}/api/companion/memory/retrieval-feedback`, ({ request }) => {
      requestedIds = new URL(request.url).searchParams.get('resultIds')?.split(',') ?? []
      return HttpResponse.json([])
    }))

    const { result } = renderHook(() => useMemoryRetrievalFeedback(ids), {
      wrapper: makeHookWrapper(),
    })

    await waitFor(() => expect(result.current.pending).toBe(false))
    await waitFor(() => expect(requestedIds).toHaveLength(100))
    expect(requestedIds).toEqual(ids.slice(1))
  })

  test('updates optimistically and rolls back when the PUT fails', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    server.use(
      http.get(`${API_BASE}/api/companion/memory/retrieval-feedback`, () =>
        HttpResponse.json([wire(A, 'useful')])),
      http.put(`${API_BASE}/api/companion/memory/retrieval/:runId/result/:resultId/feedback`, async () => {
        await gate
        return HttpResponse.json([{ code: 'FAIL' }], { status: 500 })
      }),
    )
    const { result } = renderHook(() => useMemoryRetrievalFeedback([A]), {
      wrapper: makeHookWrapper(),
    })
    await waitFor(() => expect(result.current.get(A)?.action).toBe('useful'))

    act(() => result.current.act(RUN, A, 'irrelevant'))
    await waitFor(() => expect(result.current.get(A)?.action).toBe('irrelevant'))
    act(() => release())
    await waitFor(() => expect(result.current.get(A)?.action).toBe('useful'))
  })

  test('PUTs the selected action and emits a success toast after suppression', async () => {
    let body: unknown
    const toasts: string[] = []
    const stop = onToast((toast) => {
      if ('text' in toast) toasts.push(toast.text)
    })
    server.use(
      http.get(`${API_BASE}/api/companion/memory/retrieval-feedback`, () => HttpResponse.json([])),
      http.put(`${API_BASE}/api/companion/memory/retrieval/:runId/result/:resultId/feedback`,
        async ({ request, params }) => {
          body = await request.json()
          return HttpResponse.json({
            runId: params.runId, resultId: params.resultId,
            action: (body as { action: string }).action, updatedAt: AT,
          })
        }),
    )
    try {
      const { result } = renderHook(() => useMemoryRetrievalFeedback([A]), {
        wrapper: makeHookWrapper(),
      })
      await waitFor(() => expect(result.current.pending).toBe(false))
      act(() => result.current.act(RUN, A, 'suppress'))
      await waitFor(() => expect(result.current.get(A)?.action).toBe('suppress'))
      await waitFor(() => expect(toasts).toContain('Ezt az emléket többé nem használjuk.'))
      expect(body).toEqual({ action: 'suppress' })
    } finally {
      stop()
    }
  })
})
