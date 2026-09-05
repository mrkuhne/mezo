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

  test('minden CLEAR def teljes, és egyetlen FOGG-mezőt sem hordoz', () => {
    // clearForeignFields CLEAR-ága: anchorHabitKey + anchorCopy + celebration mind null.
    // Az anchorCopy azért megy vele, mert a Nap felületen ki VAN rajzolva — egy megtartott
    // „miután …" hamis jelzést hagyna egy Clear recept alatt.
    const clear = defs.filter((d) => d.framework === 'CLEAR')
    expect(clear.length).toBeGreaterThan(0)
    for (const d of clear) {
      expect(Boolean(d.cue && d.craving && d.reward), `${d.habitKey} teljes CLEAR recept`).toBe(true)
      expect([d.anchorHabitKey, d.anchorCopy, d.celebration], `${d.habitKey} idegen FOGG-mező`)
        .toEqual([null, null, null])
    }
  })

  test('egyetlen FOGG def sem hordoz CLEAR-mezőt', () => {
    for (const d of defs.filter((d) => d.framework === 'FOGG')) {
      expect([d.cue, d.craving, d.reward, d.identity], `${d.habitKey} idegen CLEAR-mező`)
        .toEqual([null, null, null, null])
    }
  })

  test('a mock katalógus hordoz egy játszható horgony-párt (mezo-3zue.6)', () => {
    const defs = mockHabitCatalog.chains.flatMap((c) => c.defs)
    const dependent = defs.find((d) => d.habitKey === 'morning_video')
    const anchor = defs.find((d) => d.habitKey === 'morning_pushups')
    expect(dependent?.anchorHabitKey).toBe('morning_pushups')
    // mindkét oldal MANUAL és nyitott a mock napban — különben a lánc nem játszható végig
    expect(anchor?.mode).toBe('MANUAL')
    expect(dependent?.mode).toBe('MANUAL')
    const day = mockHabitDay.filter((h) => h.key === 'morning_pushups' || h.key === 'morning_video')
    expect(day).toHaveLength(2)
    expect(day.every((h) => h.status === 'pending')).toBe(true)
    // FOGG-teljes: a validátor horgonyt ÉS ünneplést vár (HabitFrameworkValidator)
    expect(dependent?.framework).toBe('FOGG')
    expect(dependent?.celebration).toBeTruthy()
  })
})
