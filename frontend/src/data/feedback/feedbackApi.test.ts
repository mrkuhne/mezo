import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { API_BASE } from '@/data/_client/api'
import { feedbackApi } from '@/data/feedback/feedbackApi'
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
    const chunkSizes = idParams.map((p) => p.split(',').length)
    expect(chunkSizes).toEqual([100, 100, 50])
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
      // Comfortably under Tomcat's 8192-byte default header limit — a chunk size raised "to save
      // a round trip" must trip this.
      expect(url.length).toBeLessThan(6000)
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
    await expect(feedbackApi.list(KIND, ids)).rejects.toBeTruthy()
  })
})
