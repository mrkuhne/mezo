import { describe, expect, test } from 'vitest'
import { mockHabitCatalog, mockHabitDay } from '@/data/habit/habitMock'

const defs = mockHabitCatalog.chains.flatMap((c) => c.defs)

describe('mock habit seed — keret-invariánsok', () => {
  test('minden FOGG def teljes: horgony ÉS ünneplés (a backend validátor szabálya)', () => {
    // HabitFrameworkValidator: FOGG = (anchorHabitKey VAGY anchorCopy) + celebration.
    // A mock nem írhat le olyan állapotot, amit a valós oldal 400-zal utasítana el.
    const fogg = defs.filter((d) => d.framework === 'FOGG')
    expect(fogg.length).toBeGreaterThan(0)
    for (const d of fogg) {
      expect(Boolean(d.anchorHabitKey || d.anchorCopy), `${d.habitKey} horgony`).toBe(true)
      expect(Boolean(d.celebration), `${d.habitKey} ünneplés`).toBe(true)
    }
  })

  test('keret nélküli def egyetlen keret-mezőt sem hordoz', () => {
    for (const d of defs.filter((d) => d.framework === null)) {
      expect([d.cue, d.craving, d.reward, d.celebration, d.identity, d.anchorHabitKey])
        .toEqual([null, null, null, null, null, null])
    }
  })

  test('mindkét lánc kínál pipálható, ünnepléses sort — a jutalom-pillanat demózható', () => {
    for (const chainKey of ['MORNING', 'EVENING']) {
      const tickable = mockHabitDay
        .filter((h) => h.chain === chainKey && h.mode === 'MANUAL' && h.status === 'pending')
        .map((h) => h.key)
      const celebrated = defs.filter((d) => tickable.includes(d.habitKey) && d.celebration)
      expect(celebrated.length, `${chainKey} ünnepléses pipálható sor`).toBeGreaterThan(0)
    }
  })
})
