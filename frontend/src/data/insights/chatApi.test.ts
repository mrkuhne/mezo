import { toChatMessage } from '@/data/insights/chatApi'

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
