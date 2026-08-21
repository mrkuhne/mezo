import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useFeedback } from '@/data/hooks'
import { API_BASE } from '@/data/_client/api'
import { server } from '@/test/msw/server'
import { makeHookWrapper } from '@/test/queryWrapper'
import type { FeedbackReason, FeedbackVerdict } from '@/data/feedback/feedbackTypes'

const KIND = 'chat_message' as const
const AT = '2026-08-21T10:00:00Z'

function wire(artifactId: string, verdict: FeedbackVerdict, reason: FeedbackReason | null = null) {
  return { artifactKind: KIND, artifactId, verdict, reason, updatedAt: AT }
}

/** Flush pending microtasks/timers so "no request was made" is a real assertion, not a race. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
}

describe('useFeedback (mock mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'true'))
  afterEach(() => vi.unstubAllEnvs())

  test('the seed is honestly empty — nothing is voted on before the user votes', () => {
    const { result } = renderHook(() => useFeedback(KIND, ['a', 'b']), { wrapper: makeHookWrapper() })
    expect(result.current.get('a')).toBeUndefined()
    expect(result.current.get('b')).toBeUndefined()
    expect(result.current.pending).toBe(false)
  })

  test('vote(up) records an up verdict with no reason', async () => {
    const { result } = renderHook(() => useFeedback(KIND, ['a', 'b']), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.vote('a', 'up')
    })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))
    expect(result.current.get('a')?.reason).toBeNull()
    expect(result.current.get('a')?.artifactKind).toBe(KIND)
    // untouched siblings stay unvoted
    expect(result.current.get('b')).toBeUndefined()
  })

  test('re-tapping the same verdict retracts it', async () => {
    const { result } = renderHook(() => useFeedback(KIND, ['a']), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.vote('a', 'up')
    })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))
    await act(async () => {
      result.current.vote('a', 'up')
    })
    await waitFor(() => expect(result.current.get('a')).toBeUndefined())
  })

  test('tapping the other verdict overwrites, carrying the reason', async () => {
    const { result } = renderHook(() => useFeedback(KIND, ['a']), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.vote('a', 'up')
    })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))
    await act(async () => {
      result.current.vote('a', 'down', 'too_much')
    })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('down'))
    expect(result.current.get('a')?.reason).toBe('too_much')
  })

  test('a DIFFERENT reason on the same verdict updates the reason (it does not retract)', async () => {
    const { result } = renderHook(() => useFeedback(KIND, ['a']), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.vote('a', 'down', 'too_much')
    })
    await waitFor(() => expect(result.current.get('a')?.reason).toBe('too_much'))
    await act(async () => {
      result.current.vote('a', 'down', 'bad_timing')
    })
    await waitFor(() => expect(result.current.get('a')?.reason).toBe('bad_timing'))
    expect(result.current.get('a')?.verdict).toBe('down')
    // …but the bare chip re-tap (no reason) still retracts.
    await act(async () => {
      result.current.vote('a', 'down')
    })
    await waitFor(() => expect(result.current.get('a')).toBeUndefined())
  })

  test('votes survive a change of the rendered id set (mock votes accumulate for the session)', async () => {
    const wrapper = makeHookWrapper()
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useFeedback(KIND, ids), {
      wrapper,
      initialProps: { ids: ['a'] },
    })
    await act(async () => {
      result.current.vote('a', 'up')
    })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))
    // A new chat message arrives → the page now renders one more id.
    rerender({ ids: ['a', 'b'] })
    expect(result.current.get('a')?.verdict).toBe('up')
  })

  test('makes no network call at all', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const { result } = renderHook(() => useFeedback(KIND, ['a', 'b']), { wrapper: makeHookWrapper() })
      await act(async () => {
        result.current.vote('a', 'up')
      })
      await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))
      await flush()
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('useFeedback (real mode)', () => {
  beforeEach(() => vi.stubEnv('VITE_USE_MOCK', 'false'))
  afterEach(() => vi.unstubAllEnvs())

  test('batch-reads once with comma-joined ids and hydrates get()', async () => {
    const searches: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        searches.push(new URL(request.url).search)
        return HttpResponse.json([wire('a', 'down', 'inaccurate')])
      }),
    )
    const { result } = renderHook(() => useFeedback(KIND, ['a', 'b']), { wrapper: makeHookWrapper() })
    // never the mock seed and never a fabricated row while unresolved
    expect(result.current.get('a')).toBeUndefined()
    await waitFor(() => expect(result.current.get('a')).toBeDefined())
    expect(searches).toEqual(['?kind=chat_message&ids=a,b'])
    expect(result.current.get('a')).toEqual({
      artifactKind: KIND,
      artifactId: 'a',
      verdict: 'down',
      reason: 'inaccurate',
      updatedAt: AT,
    })
    // ids absent from the response simply carry no verdict
    expect(result.current.get('b')).toBeUndefined()
    await flush()
    expect(searches).toHaveLength(1)
  })

  test('vote PUTs and shows the new verdict optimistically, before the response resolves', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => {
      release = r
    })
    let stored = [wire('b', 'up')]
    let body: unknown
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => HttpResponse.json(stored)),
      http.put(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
        body = await request.json()
        await gate
        const saved = { ...(body as Record<string, unknown>), updatedAt: AT }
        stored = [wire('b', 'up'), saved as ReturnType<typeof wire>]
        return HttpResponse.json(saved)
      }),
    )
    const { result } = renderHook(() => useFeedback(KIND, ['a', 'b']), { wrapper: makeHookWrapper() })
    // the batch read has landed (b's verdict proves it) before we vote on a
    await waitFor(() => expect(result.current.get('b')?.verdict).toBe('up'))

    act(() => {
      result.current.vote('a', 'down', 'bad_timing')
    })
    // optimistic — the PUT is still gated open
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('down'))
    expect(result.current.get('a')?.reason).toBe('bad_timing')
    expect(result.current.pending).toBe(true)

    await act(async () => {
      release()
      await gate
    })
    await waitFor(() => expect(result.current.pending).toBe(false))
    expect(body).toEqual({ artifactKind: KIND, artifactId: 'a', verdict: 'down', reason: 'bad_timing' })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('down'))
    expect(result.current.get('b')?.verdict).toBe('up')
  })

  test('re-tapping the same verdict DELETEs the row', async () => {
    let stored = [wire('a', 'up')]
    const deleted: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => HttpResponse.json(stored)),
      http.delete(`${API_BASE}/api/companion/feedback/:kind/:id`, ({ params }) => {
        deleted.push(`${params.kind}/${params.id}`)
        stored = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const { result } = renderHook(() => useFeedback(KIND, ['a']), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))

    await act(async () => {
      result.current.vote('a', 'up')
    })
    await waitFor(() => expect(deleted).toEqual(['chat_message/a']))
    await waitFor(() => expect(result.current.get('a')).toBeUndefined())
  })

  test('an empty id list issues NO request (the contract requires minItems: 1)', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => {
        calls += 1
        return HttpResponse.json([])
      }),
    )
    const { result } = renderHook(() => useFeedback(KIND, []), { wrapper: makeHookWrapper() })
    await flush()
    expect(calls).toBe(0)
    expect(result.current.get('a')).toBeUndefined()
  })

  test('a failing batch read degrades to "no verdicts" and never throws (IDENT-3)', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => {
        calls += 1
        return HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'boom', type: 'REQUEST' }], { status: 500 })
      }),
    )
    const { result } = renderHook(() => useFeedback(KIND, ['a', 'b']), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(calls).toBe(1))
    await flush()
    expect(result.current.get('a')).toBeUndefined()
    expect(result.current.get('b')).toBeUndefined()
    expect(result.current.pending).toBe(false)
  })
})
