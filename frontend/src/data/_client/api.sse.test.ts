import { apiSse, ApiError, API_BASE } from '@/data/_client/api'

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

afterEach(() => vi.unstubAllGlobals())

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
