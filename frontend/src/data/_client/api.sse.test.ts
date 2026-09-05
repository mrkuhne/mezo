import { apiSse, ApiError, API_BASE, setToken } from '@/data/_client/api'
import { authEvents } from '@/data/_client/authEvents'
import { tokenStore } from '@/data/_client/tokenStore'

function sseResponse(frames: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((f) => controller.enqueue(encoder.encode(f)))
      controller.close()
    },
  })
  return new Response(stream, { status, headers: { 'Content-Type': 'text/event-stream' } })
}

async function collect(gen: AsyncGenerator<{ event: string; data: string }>) {
  const out: { event: string; data: string }[] = []
  for await (const ev of gen) out.push(ev)
  return out
}

/** A stream that yields `frames`, then dies mid-flight the way a dropped connection does. */
function dyingSseResponse(frames: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((f) => controller.enqueue(encoder.encode(f)))
      controller.error(new TypeError('network error'))
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

afterEach(() => {
  vi.unstubAllGlobals()
  setToken(null)
})

test('parses named events with JSON data lines', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    sseResponse(['event:delta\ndata:{"text":"szia"}\n\n', 'event:done\ndata:{"id":"m1"}\n\n'])))
  const events = await collect(apiSse('/api/x', { method: 'POST', body: '{}' }))
  expect(events).toEqual([
    { event: 'delta', data: '{"text":"szia"}' },
    { event: 'done', data: '{"id":"m1"}' },
  ])
})

test('reassembles events split across network chunks (and tolerates CRLF + "data: " space)', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    sseResponse(['event: delta\r\ndata: {"te', 'xt":"fé"}\r\n\r\nevent:done\ndata:{}\n\n'])))
  const events = await collect(apiSse('/api/x'))
  expect(events).toEqual([
    { event: 'delta', data: '{"text":"fé"}' },
    { event: 'done', data: '{}' },
  ])
})

test('throws ApiError with the SystemMessage body on a non-OK response', async () => {
  vi.stubGlobal('fetch', vi.fn(async () =>
    new Response(JSON.stringify([{ code: 'RESOURCE_NOT_FOUND', message: 'nope' }]), { status: 404 })))
  await expect(collect(apiSse('/api/x'))).rejects.toSatisfy(
    (e: unknown) => e instanceof ApiError && e.status === 404 && e.messages[0].code === 'RESOURCE_NOT_FOUND')
})

test('targets API_BASE with the SSE accept header', async () => {
  const spy = vi.fn(async () => sseResponse(['event:done\ndata:{}\n\n']))
  vi.stubGlobal('fetch', spy)
  await collect(apiSse('/api/x'))
  const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit]
  expect(url).toBe(`${API_BASE}/api/x`)
  expect(new Headers(init.headers).get('Accept')).toContain('text/event-stream')
})

// ── mezo-qw37.8: session probe after a mid-stream failure ────────────────────────
//
// The response was already 200 when the body started, so a failure DURING the read
// arrives as a read error, never as a status code. Spring authorises a request once,
// at entry, so an expiring token cannot turn this stream into a 401 either — a dead
// session only surfaces on the NEXT request. Without a probe the user is left looking
// at a generic stream error with no way to tell they have been signed out.

test('probes /api/auth/me when the stream dies mid-flight, and still rethrows the read error', async () => {
  setToken('live-token')
  const spy = vi.fn(async (url: string) =>
    String(url).endsWith('/api/auth/me')
      ? new Response(JSON.stringify({ id: 'u1' }), { status: 200 })
      : dyingSseResponse(['event:delta\ndata:{"text":"sz"}\n\n']))
  vi.stubGlobal('fetch', spy)

  await expect(collect(apiSse('/api/x'))).rejects.toThrow(/network error/)

  expect(spy.mock.calls.map((c) => String(c[0]))).toContain(`${API_BASE}/api/auth/me`)
})

test('a mid-stream failure on a dead session signs the user out (mezo-qw37.8)', async () => {
  setToken('stale-token')
  const reasons: string[] = []
  const off = authEvents.onSignedOut((r) => reasons.push(r))
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    String(url).endsWith('/api/auth/me')
      ? new Response(JSON.stringify([{ code: 'AUTH_TOKEN_EXPIRED', message: 'expired' }]), { status: 401 })
      : dyingSseResponse(['event:delta\ndata:{"text":"sz"}\n\n'])))

  await expect(collect(apiSse('/api/x'))).rejects.toThrow(/network error/)

  expect(reasons).toEqual(['expired'])
  expect(tokenStore.get()).toBeNull()
  off()
})

test('does not probe when there is no token to begin with', async () => {
  setToken(null)
  const spy = vi.fn(async () => dyingSseResponse(['event:delta\ndata:{"text":"sz"}\n\n']))
  vi.stubGlobal('fetch', spy)

  await expect(collect(apiSse('/api/x'))).rejects.toThrow(/network error/)

  expect(spy).toHaveBeenCalledTimes(1)
})

test('does not probe when the consumer just stops reading early', async () => {
  setToken('live-token')
  const spy = vi.fn(async () => sseResponse(['event:delta\ndata:{"text":"sz"}\n\n', 'event:done\ndata:{}\n\n']))
  vi.stubGlobal('fetch', spy)

  // The companion consumer returns out of the for-await on `done`; that is an ordinary
  // early exit, not a failure, and must not cost an auth round-trip.
  for await (const ev of apiSse('/api/x')) {
    if (ev.event === 'delta') break
  }

  expect(spy).toHaveBeenCalledTimes(1)
})
