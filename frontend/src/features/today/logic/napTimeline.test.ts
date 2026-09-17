import { buildNapTimeline } from '@/features/today/logic/napTimeline'
import type { ActivityEntry } from '@/data/types'
const activity = (id: string, day: string, createdAt?: string): ActivityEntry => ({ id, occurredOn: day, text: id, createdAt, skillKey: null, confidence: null, xpAwarded: 0, categorizedBy: null })
it('filters by recorded day, sorts known times, and does not invent timestamps', () => {
  const rows = buildNapTimeline('2026-09-17', [], [], [], [activity('old', '2026-09-16'), activity('unknown', '2026-09-17'), activity('late', '2026-09-17', '2026-09-17T18:30:00'), activity('early', '2026-09-17', '2026-09-17T08:00:00')])
  expect(rows.map(r => r.id)).toEqual(['activity:late', 'activity:early', 'activity:unknown'])
  expect(rows[2].time).toBeNull()
})
it('includes only saved check-ins, and never uses the scheduled slot as save time', () => {
  const rows = buildNapTimeline('2026-09-17', [{ time: '08:00', state: 'done', values: null, note: 'Gondolat' }, { time: '12:00', state: 'now', values: null, note: null }], [], [], [])
  expect(rows).toHaveLength(1); expect(rows[0].time).toBeNull(); expect(rows[0].text).toBe('Gondolat')
})
