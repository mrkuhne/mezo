import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useFeedback } from '@/data/hooks'
import { API_BASE } from '@/data/_client/api'
import { FEEDBACK_MAX_IDS, feedbackApi } from '@/data/feedback/feedbackApi'
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

  test('re-picking the SAME reason keeps the vote — only a bare re-tap retracts', async () => {
    const { result } = renderHook(() => useFeedback(KIND, ['a']), { wrapper: makeHookWrapper() })
    await act(async () => {
      result.current.vote('a', 'down', 'too_much')
    })
    await waitFor(() => expect(result.current.get('a')?.reason).toBe('too_much'))
    // The user opens the reason row and confirms the reason that is already stored.
    await act(async () => {
      result.current.vote('a', 'down', 'too_much')
    })
    await flush()
    expect(result.current.get('a')?.verdict).toBe('down')
    expect(result.current.get('a')?.reason).toBe('too_much')
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

  test('a GROWING id set never blanks the verdicts already on screen, and hydrates the new ids', async () => {
    const searches: string[] = []
    let release: () => void = () => {}
    const secondRead = new Promise<void>((r) => {
      release = r
    })
    const stored: Record<string, ReturnType<typeof wire>> = {
      a: wire('a', 'up'),
      b: wire('b', 'down', 'inaccurate'),
    }
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, async ({ request }) => {
        const url = new URL(request.url)
        searches.push(url.search)
        if (searches.length >= 2) await secondRead // hold the wider read open
        const ids = (url.searchParams.get('ids') ?? '').split(',').filter(Boolean)
        return HttpResponse.json(ids.flatMap((id) => (stored[id] ? [stored[id]] : [])))
      }),
    )
    const { result, rerender } = renderHook(({ ids }: { ids: string[] }) => useFeedback(KIND, ids), {
      wrapper: makeHookWrapper(),
      initialProps: { ids: ['a'] },
    })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))

    // A new message arrives → the page renders one more id.
    rerender({ ids: ['a', 'b'] })
    // (a) NOT ONE neutral frame: the known verdict survives the key change…
    expect(result.current.get('a')?.verdict).toBe('up')
    await waitFor(() => expect(searches).toHaveLength(2))
    expect(result.current.get('a')?.verdict).toBe('up') // …and the whole round-trip
    expect(result.current.get('b')).toBeUndefined()

    // (b) the genuinely-new id hydrates once the wider read lands
    await act(async () => {
      release()
      await secondRead
    })
    await waitFor(() => expect(result.current.get('b')?.verdict).toBe('down'))
    expect(result.current.get('a')?.verdict).toBe('up')
    expect(searches).toEqual(['?kind=chat_message&ids=a', '?kind=chat_message&ids=a,b'])

    // (c) a re-render passing a FRESH array with the same ids must not refetch (no loop)
    rerender({ ids: ['a', 'b'] })
    rerender({ ids: ['b', 'a'] }) // same set, different order — same fingerprint
    await flush()
    expect(searches).toHaveLength(2)
  })

  test('a failed vote rolls the optimistic row back to its pre-vote value', async () => {
    let getCalls = 0
    server.use(
      // Only the FIRST read succeeds — so the post-failure invalidate CANNOT be what restores the
      // pre-vote value; the onMutate snapshot → onError rollback has to do it on its own.
      http.get(`${API_BASE}/api/companion/feedback`, () => {
        getCalls += 1
        return getCalls === 1
          ? HttpResponse.json([wire('a', 'up')])
          : HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'boom', type: 'REQUEST' }], { status: 500 })
      }),
      http.put(`${API_BASE}/api/companion/feedback`, () =>
        HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'boom', type: 'REQUEST' }], { status: 500 }),
      ),
    )
    const { result } = renderHook(() => useFeedback(KIND, ['a']), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.get('a')?.verdict).toBe('up'))

    await act(async () => {
      result.current.vote('a', 'down', 'inaccurate')
    })
    await waitFor(() => expect(result.current.pending).toBe(false))
    await flush()
    expect(result.current.get('a')?.verdict).toBe('up')
    expect(result.current.get('a')?.reason).toBeNull()
  })

  test('hydrates every chip on a page past the old single-request cap', async () => {
    // 250 ids: the old FEEDBACK_MAX_IDS of 200 would have sliced this down to the last 200,
    // silently dropping the oldest 50 (including this one) before any header limit was hit.
    const ids = Array.from({ length: 250 }, (_, i) => `m${i}`)
    const oldestId = ids[0]
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        const requested = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean)
        return HttpResponse.json(requested.includes(oldestId) ? [wire(oldestId, 'up')] : [])
      }),
    )
    const { result } = renderHook(() => useFeedback(KIND, ids), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(result.current.get(oldestId)?.verdict).toBe('up'))
  })

  test('still bounds the request at FEEDBACK_MAX_IDS, keeping the NEWEST (last) ids', async () => {
    const requestedByChunk: string[][] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        const chunk = (new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(Boolean)
        requestedByChunk.push(chunk)
        return HttpResponse.json([])
      }),
    )
    const ids = Array.from({ length: FEEDBACK_MAX_IDS + 50 }, (_, i) => `m${i}`)
    renderHook(() => useFeedback(KIND, ids), { wrapper: makeHookWrapper() })
    await waitFor(() => expect(requestedByChunk.length).toBeGreaterThan(0))
    // Chunking (mezo-b3pp.23) spreads the read across several requests; the hook still runs a
    // single logical query, so summing every chunk's ids must reconstruct the whole request.
    await waitFor(() => {
      const total = requestedByChunk.flat().length
      expect(total).toBe(FEEDBACK_MAX_IDS)
    })
    const sent = requestedByChunk.flat()
    // the tail (what the user is actually looking at) is kept; the oldest head is dropped
    expect(sent[0]).toBe('m50')
    expect(sent.at(-1)).toBe(`m${FEEDBACK_MAX_IDS + 49}`)
    expect(sent).not.toContain('m0')
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

  test('the DEFAULT msw handlers answer all three calls (no live-connection fallthrough for Tasks 6–9)', async () => {
    // Deliberately no server.use() — this pins src/test/msw/handlers.ts's defaults, so real-mode
    // component tests that render a 👍/👎 surface never fall through to localhost:8090.
    await expect(feedbackApi.list(KIND, ['a'])).resolves.toEqual([])
    await expect(feedbackApi.put(KIND, 'a', 'down', 'too_much')).resolves.toEqual({
      artifactKind: KIND,
      artifactId: 'a',
      verdict: 'down',
      reason: 'too_much',
      updatedAt: '2026-08-21T12:00:00Z',
    })
    await expect(feedbackApi.remove(KIND, 'a')).resolves.toBeUndefined()
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
