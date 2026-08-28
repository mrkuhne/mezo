import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { ApiError, API_BASE } from '@/data/_client/api'
import { FEEDBACK_IDS_PER_REQUEST, feedbackApi } from '@/data/feedback/feedbackApi'
import { server } from '@/test/msw/server'
import type { FeedbackVerdict } from '@/data/feedback/feedbackTypes'

const KIND = 'chat_message' as const
const AT = '2026-08-21T10:00:00Z'

function wire(artifactId: string, verdict: FeedbackVerdict) {
  return { artifactKind: KIND, artifactId, verdict, reason: null, updatedAt: AT }
}

/** Every case here talks to `feedbackApi.list` directly — no hook, no cache — so what's asserted
 * is exactly what went over the wire, recorded from the MSW handler itself. */
describe('feedbackApi.list chunking (mezo-b3pp.23)', () => {
  test('list_shouldSendOneRequest_whenIdsFitInOneChunk', async () => {
    const idParams: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        idParams.push(new URL(request.url).searchParams.get('ids') ?? '')
        return HttpResponse.json([])
      }),
    )
    const ids = Array.from({ length: 100 }, (_, i) => `id${i}`)
    await feedbackApi.list(KIND, ids)
    expect(idParams).toHaveLength(1)
    expect(idParams[0].split(',')).toEqual(ids)
  })

  test('list_shouldSplitIntoTwoRequests_whenIdsExceedOneChunk', async () => {
    const idParams: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        idParams.push(new URL(request.url).searchParams.get('ids') ?? '')
        return HttpResponse.json([])
      }),
    )
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`)
    await feedbackApi.list(KIND, ids)
    expect(idParams).toHaveLength(2)
    const chunkSizes = idParams.map((p) => p.split(',').length).sort((a, b) => b - a)
    expect(chunkSizes).toEqual([100, 1])
    const union = idParams.flatMap((p) => p.split(','))
    expect(union.sort()).toEqual([...ids].sort())
    expect(new Set(union).size).toBe(union.length) // no id sent twice
  })

  test('list_shouldSplitIntoThreeRequests_whenIdsAreWellOverTwoChunks', async () => {
    const idParams: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        idParams.push(new URL(request.url).searchParams.get('ids') ?? '')
        return HttpResponse.json([])
      }),
    )
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`)
    await feedbackApi.list(KIND, ids)
    expect(idParams).toHaveLength(3)
    // MSW may record concurrent requests in any dispatch order — assert the multiset (sizes sum
    // to the total, none exceeds the per-request cap), not a fixed positional order.
    const chunkSizes = idParams.map((p) => p.split(',').length)
    expect(chunkSizes.reduce((a, b) => a + b, 0)).toBe(250)
    for (const size of chunkSizes) {
      expect(size).toBeLessThanOrEqual(100)
    }
    expect(chunkSizes.sort((a, b) => b - a)).toEqual([100, 100, 50])
  })

  test('list_shouldMergeEveryChunksRows_whenSeveralChunksAnswer', async () => {
    let call = 0
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => {
        call += 1
        return call === 1 ? HttpResponse.json([wire('first', 'up')]) : HttpResponse.json([wire('second', 'down')])
      }),
    )
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`)
    const result = await feedbackApi.list(KIND, ids)
    expect(result.map((r) => ({ artifactId: r.artifactId, verdict: r.verdict }))).toEqual(
      expect.arrayContaining([
        { artifactId: 'first', verdict: 'up' },
        { artifactId: 'second', verdict: 'down' },
      ]),
    )
    expect(result).toHaveLength(2)
  })

  test('list_shouldKeepEveryRequestUnderTheHeaderBudget', async () => {
    const urls: string[] = []
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, ({ request }) => {
        urls.push(request.url)
        return HttpResponse.json([])
      }),
    )
    // Real uuids, not short synthetic ids — the actual bug was header size, not id count.
    const ids = Array.from({ length: 200 }, (_, i) => `${i.toString().padStart(8, '0')}-aaaa-bbbb-cccc-1234567890ab`)
    await feedbackApi.list(KIND, ids)
    expect(urls.length).toBeGreaterThan(1)
    for (const url of urls) {
      const requestedIds = (new URL(url).searchParams.get('ids') ?? '').split(',').filter(Boolean)
      // Pin the actual budget, not a threshold a bigger chunk size could sneak under: no ONE
      // request may carry more ids than FEEDBACK_IDS_PER_REQUEST, and — since a chunk-size bump
      // alone wouldn't move the URL length much until it's already too late — the URL itself must
      // stay well under Tomcat's 8192-byte default header limit, leaving real room for
      // `Authorization: Bearer <JWT>` plus the browser's own headers. 150 ids (~5.6 KB) passes the
      // old `< 6000` anchor but leaves under 2.5 KB for those — 4500 does not let that through.
      expect(requestedIds.length).toBeLessThanOrEqual(FEEDBACK_IDS_PER_REQUEST)
      expect(url.length).toBeLessThan(4500)
    }
  })

  test('list_shouldSendNoRequest_whenIdsIsEmpty', async () => {
    let calls = 0
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => {
        calls += 1
        return HttpResponse.json([])
      }),
    )
    const result = await feedbackApi.list(KIND, [])
    expect(calls).toBe(0)
    expect(result).toEqual([])
  })

  test('list_shouldReject_whenOneChunkFails', async () => {
    let call = 0
    server.use(
      http.get(`${API_BASE}/api/companion/feedback`, () => {
        call += 1
        if (call === 2) {
          return HttpResponse.json([{ code: 'INTERNAL_ERROR', message: 'boom', type: 'REQUEST' }], { status: 500 })
        }
        return HttpResponse.json([wire('ok', 'up')])
      }),
    )
    const ids = Array.from({ length: 101 }, (_, i) => `id${i}`)
    const error = await feedbackApi.list(KIND, ids).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
  })
})
