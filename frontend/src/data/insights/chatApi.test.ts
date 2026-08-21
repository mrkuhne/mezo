import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { chatApi, toChatMessage } from '@/data/insights/chatApi'

test('maps a wire MessageResponse to the FE ChatMessage shape', () => {
  const mapped = toChatMessage({
    id: 'm1', role: 'assistant', content: 'Szia!', createdAt: '2026-07-03T06:32:00Z',
    tools: [{ type: 'read', name: 'get_sleep(days=7)' }],
    refs: [{ kind: 'SleepLog', id: 'sl-1' }],
    degraded: false,
  })
  expect(mapped.role).toBe('assistant')
  expect(mapped.text).toBe('Szia!')
  expect(mapped.ts).toMatch(/^\d{2}:\d{2}$/)
  expect(mapped.tools).toEqual([{ type: 'read', name: 'get_sleep(days=7)' }])
  expect(mapped.refs).toEqual([{ kind: 'SleepLog', id: 'sl-1' }])
})

test('omits empty tools/refs so user bubbles stay lean', () => {
  const mapped = toChatMessage({
    id: 'm2', role: 'user', content: 'hello', createdAt: '2026-07-03T06:34:00Z', tools: [], refs: [],
    degraded: false,
  })
  expect(mapped.tools).toBeUndefined()
  expect(mapped.refs).toBeUndefined()
  // V1.3: a clean answer carries no degraded prop at all (mock messages never set it)
  expect(mapped.degraded).toBeUndefined()
})

test('maps a degraded answer so the bubble can render the flag (V1.3)', () => {
  const mapped = toChatMessage({
    id: 'm3', role: 'assistant', content: 'bizonytalan válasz', createdAt: '2026-07-03T06:35:00Z',
    tools: [], refs: [], degraded: true,
  })
  expect(mapped.degraded).toBe(true)
})

test('transcribe posts the clip as multipart and returns the text (mezo-at8x.4)', async () => {
  let contentType: string | null = null
  let audioPart: unknown
  server.use(http.post(`${API_BASE}/api/companion/transcribe`, async ({ request }) => {
    contentType = request.headers.get('content-type')
    audioPart = (await request.formData()).get('audio')
    return HttpResponse.json({ text: 'Fáradt vagyok.' })
  }))

  const text = await chatApi.transcribe(new Blob([new Uint8Array(16)], { type: 'audio/wav' }))

  expect(text).toBe('Fáradt vagyok.')
  // The browser (not apiFetch) sets the multipart boundary — the request must NOT be JSON.
  expect(contentType).toMatch(/^multipart\/form-data; boundary=/)
  expect(audioPart).not.toBeNull()
})

test('carries the persisted row id — the W4.1 feedback artifactId (mezo-b3pp.15)', () => {
  const mapped = toChatMessage({
    id: '0b4f6c1e-0000-4000-8000-000000000001', role: 'assistant', content: 'Szia!',
    createdAt: '2026-07-03T06:32:00Z', tools: [], refs: [], degraded: false,
  })
  // Without the id the answer has nothing to vote on — the chips simply would not render.
  expect(mapped.id).toBe('0b4f6c1e-0000-4000-8000-000000000001')
})
