import { describe, expect, it } from 'vitest'
import { groupByDay } from '@/features/notification/logic/groupByDay'
import type { AppNotificationView } from '@/data/types'

// Minden időbélyeg dél körüli UTC: így a futtató gép időzónája (±12 h) nem tolhatja át az elemet
// egy szomszédos naptári napra, és a teszt CI-ben (UTC) is ugyanazt jelenti, mint itthon.
const item = (id: string, occurredAt: string): AppNotificationView => ({
  id, kind: 'memory_note', title: 't', body: null, deeplink: '/insights', occurredAt, readAt: null,
})

describe('groupByDay', () => {
  it('splits Ma / Tegnap against the given today', () => {
    const groups = groupByDay([
      item('a', '2026-08-18T12:00:00.000Z'),
      item('b', '2026-08-17T12:00:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'Tegnap'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['a'])
    expect(groups[1].items.map((i) => i.id)).toEqual(['b'])
  })

  // A dropdown 3 sorában a „Korábban" gyűjtőbucket elég volt; egy teljes oldalon két hét
  // egyetlen cím alá söpörve használhatatlan (mezo-nol0).
  it('gives every older day its own dated label', () => {
    const groups = groupByDay([
      item('a', '2026-08-18T12:00:00.000Z'),
      item('b', '2026-08-15T12:00:00.000Z'),
      item('c', '2026-08-14T12:00:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'aug. 15.', 'aug. 14.'])
    expect(groups.some((g) => g.label === 'Korábban')).toBe(false)
  })

  it('sorts newest-first inside a group and across groups, whatever order it is given', () => {
    const groups = groupByDay([
      item('old', '2026-08-14T12:00:00.000Z'),
      item('now2', '2026-08-18T14:00:00.000Z'),
      item('now1', '2026-08-18T10:00:00.000Z'),
    ], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma', 'aug. 14.'])
    expect(groups[0].items.map((i) => i.id)).toEqual(['now2', 'now1'])
  })

  it('returns exactly one group for a single-day feed', () => {
    const groups = groupByDay([item('a', '2026-08-18T12:00:00.000Z')], '2026-08-18')
    expect(groups.map((g) => g.label)).toEqual(['Ma'])
  })

  it('returns nothing for an empty feed', () => {
    expect(groupByDay([], '2026-08-18')).toEqual([])
  })

  // A csoport IDENTITÁSA a dátum, nem a megjelenített címke — különben két, pontosan egy évre
  // lévő elem ugyanabba a csoportba esne (mezo-nol0).
  it('keeps same-day-different-year items in separate groups', () => {
    const groups = groupByDay([
      item('new', '2026-08-15T12:00:00.000Z'),
      item('old', '2025-08-15T12:00:00.000Z'),
    ], '2026-08-18')
    expect(groups).toHaveLength(2)
    expect(groups[0].items.map((i) => i.id)).toEqual(['new'])
    expect(groups[1].items.map((i) => i.id)).toEqual(['old'])
    expect(groups.map((g) => g.day)).toEqual(['2026-08-15', '2025-08-15'])
  })

  // Hónapforduló: a „tegnap" a hónap utolsó napja, az azelőtti pedig dátum-címkét kap.
  it('crosses a month boundary without mislabelling', () => {
    const groups = groupByDay([
      item('a', '2026-07-31T12:00:00.000Z'),
      item('b', '2026-07-30T12:00:00.000Z'),
    ], '2026-08-01')
    expect(groups.map((g) => g.label)).toEqual(['Tegnap', 'júl. 30.'])
  })
})
