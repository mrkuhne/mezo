import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw/server'
import { API_BASE } from '@/test/msw/handlers'
import { chatApi, toChatMessage } from '@/data/insights/chatApi'

test('maps a wire MessageResponse to the FE ChatMessage shape', () => {
  const mapped = toChatMessage({
    id: 'm1', role: 'assistant', content: 'Szia!', createdAt: '2026-07-03T06:32:00Z',
    tools: [{ type: 'read', name: 'get_recovery(days=7)' }],
    refs: [{ kind: 'SleepLog', id: 'sl-1' }],
    recalled: [],
    degraded: false,
  })
  expect(mapped.role).toBe('assistant')
  expect(mapped.text).toBe('Szia!')
  expect(mapped.ts).toMatch(/^\d{2}:\d{2}$/)
  expect(mapped.tools).toEqual([{ type: 'read', name: 'get_recovery(days=7)' }])
  expect(mapped.refs).toEqual([{ kind: 'SleepLog', id: 'sl-1' }])
})

test('omits empty tools/refs so user bubbles stay lean', () => {
  const mapped = toChatMessage({
    id: 'm2', role: 'user', content: 'hello', createdAt: '2026-07-03T06:34:00Z', tools: [], refs: [],
    recalled: [],
    degraded: false,
  })
  expect(mapped.tools).toBeUndefined()
  expect(mapped.refs).toBeUndefined()
  // W3.1b: `recalled: []` is the wire's "nothing was recalled" — it must NOT become an
  // empty Emlékek row on the bubble.
  expect(mapped.recalled).toBeUndefined()
  // V1.3: a clean answer carries no degraded prop at all (mock messages never set it)
  expect(mapped.degraded).toBeUndefined()
})

test('passes the recalled memories through untouched so the Emlékek row can render (mezo-b3pp.28)', () => {
  const recalled = [
    {
      occurredOn: '2026-05-21', kind: 'SleepLog', label: 'Alvás', gist: '7.2 h, 4 ébredés', similarity: 0.84,
      retrievalRunId: 'ca425c7b-b738-49b6-bde3-e76b73d45962',
      retrievalResultId: '4776cb22-2d64-413d-be2b-450a8c3ff5da',
      memoryItemId: '98f87302-51a9-47a6-a3b9-f4e3e799973a', indicator: 'old',
    },
    { occurredOn: '2026-03-04', kind: 'Workout', label: 'Pull Day', gist: 'Lat Pulldown 105 × 9', similarity: 0.71 },
  ]
  const mapped = toChatMessage({
    id: 'm4', role: 'assistant', content: 'Jó jel.', createdAt: '2026-07-03T06:36:00Z',
    tools: [], refs: [], recalled, degraded: false,
  })
  // Same order, same values — legacy and unified provenance both survive the wire adapter.
  expect(mapped.recalled).toEqual(recalled)
})

test('maps a degraded answer so the bubble can render the flag (V1.3)', () => {
  const mapped = toChatMessage({
    id: 'm3', role: 'assistant', content: 'bizonytalan válasz', createdAt: '2026-07-03T06:35:00Z',
    tools: [], refs: [], recalled: [], degraded: true,
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
    createdAt: '2026-07-03T06:32:00Z', tools: [], refs: [], recalled: [], degraded: false,
  })
  // Without the id the answer has nothing to vote on — the chips simply would not render.
  expect(mapped.id).toBe('0b4f6c1e-0000-4000-8000-000000000001')
})
