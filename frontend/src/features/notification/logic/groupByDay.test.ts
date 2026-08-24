import { describe, expect, it } from 'vitest'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import type { AppNotificationView } from '@/data/types'

const item = (id: string, occurredAt: string): AppNotificationView => ({
  id, kind: 'memory_note', title: 't', body: null, deeplink: '/insights', occurredAt, readAt: null,
})

describe('groupByDay', () => {
  it('splits Ma / Tegnap / Korábban against the given today', () => {
    const groups = groupByDay([
      item('a', '2026-08-18T06:12:00.000Z'),
      item('b', '2026-08-17T21:40:00.000Z'),
      item('c', '2026-08-15T19:15:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'Tegnap', 'Korábban'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a'])
    expect(groups[2].items.map((i) => i.id)).toEqual(['c'])
  })

  it('omits empty groups', () => {
    const groups = groupByDay([item('a', '2026-08-18T06:12:00.000Z')], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma'])
  })
})
