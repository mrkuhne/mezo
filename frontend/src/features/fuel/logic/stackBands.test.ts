// ============================================================
// Mezo · stackBands tests (Fuel Titanium S2, mezo-g2vl — manifeszt D1).
//
// A mai kiegészítő-lista IDŐSÁVOK szerint csoportosul: ez az owner fő nézete („Mit veszek be
// ma?"). A sávkulcsok és a feliratok a PRODUKCIÓS napszak-modellből jönnek (`ZONE_KEYS` /
// `ZONE_LABELS`, mezo-rrtj) — párhuzamos szótárt nem nyitunk.
//
// Őszinte-null: adag nélküli tételnél nincs kitalált mennyiség, és időbélyeg nélküli bevételnél
// nincs kitalált időpont.
// ============================================================
import { describe, expect, test } from 'vitest'
import { groupStackByBand, nextDueBand } from '@/features/fuel/logic/stackBands'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import type { Intake } from '@/data/fuel/fuelApi'

const ANCHORS = { wake: '06:45', bed: '23:00' }

function entry(over: Partial<StackDayEntry> & { pantryItemId: string; name: string }): StackDayEntry {
  return {
    occurrenceId: `occ-${over.pantryItemId}`,
    persistedZone: 'wake',
    dose: '5 g',
    pinned: false,
    placementSource: 'rule',
    reason: null,
    dailyTotalHint: null,
    skippedToday: false,
    displacedToday: false,
    taken: false,
    ...over,
  }
}

function slot(over: Partial<StackDaySlot> & { zone: StackDaySlot['zone']; time: string }): StackDaySlot {
  return { label: 'Zóna', anchorNote: null, entries: [], ...over }
}

/** Reggel · dél · délután · este — egy-egy tétel mindegyikben. */
const SLOTS: StackDaySlot[] = [
  slot({ zone: 'wake', time: '06:45', label: 'Ébredés', entries: [entry({ pantryItemId: 'kreatin', name: 'Kreatin' })] }),
  slot({ zone: 'lunch', time: '12:30', label: 'Ebéd', entries: [entry({ pantryItemId: 'd3', name: 'D3-vitamin', persistedZone: 'lunch' })] }),
  slot({ zone: 'post_workout', time: '17:30', label: 'Edzés után', entries: [entry({ pantryItemId: 'fehérje', name: 'Fehérje', persistedZone: 'post_workout' })] }),
  slot({ zone: 'evening', time: '21:00', label: 'Este', entries: [entry({ pantryItemId: 'magnezium', name: 'Magnézium', persistedZone: 'evening' })] }),
]

const intake = (pantryItemId: string, slotKey: string, takenAt: string): Intake =>
  ({ id: `intake-${pantryItemId}`, pantryItemId, slotKey, takenAt, dose: null })

describe('groupStackByBand', () => {
  test('a tételek a saját idősávjukba kerülnek, a sávok időrendben állnak', () => {
    const bands = groupStackByBand(SLOTS, [], ANCHORS)
    expect(bands.map(b => b.key)).toEqual(['morning', 'midday', 'afternoon', 'evening'])
    expect(bands.map(b => b.label)).toEqual(['Reggel', 'Dél', 'Délután', 'Este'])
  })

  test('az üres idősáv nem jelenik meg', () => {
    expect(groupStackByBand([SLOTS[0]], [], ANCHORS).map(b => b.key)).toEqual(['morning'])
  })

  test('a bevett tétel a bevétel idejével jön vissza', () => {
    const bands = groupStackByBand(
      [slot({ ...SLOTS[0], entries: [entry({ pantryItemId: 'kreatin', name: 'Kreatin', taken: true })] })],
      [intake('kreatin', 'wake', '2026-09-12T05:42:00Z')],
      ANCHORS,
    )
    expect(bands[0].rows[0].taken).toBe(true)
    expect(bands[0].rows[0].takenAtHHmm).toMatch(/^\d{2}:\d{2}$/)
  })

  test('időbélyeg nélküli bevételnél nincs kitalált időpont', () => {
    const bands = groupStackByBand(
      [slot({ ...SLOTS[0], entries: [entry({ pantryItemId: 'kreatin', name: 'Kreatin', taken: true })] })],
      [intake('kreatin', 'wake', '')],
      ANCHORS,
    )
    expect(bands[0].rows[0].takenAtHHmm).toBeNull()
  })

  test('a sáv készültsége a bevett tételek száma', () => {
    const bands = groupStackByBand(
      [slot({
        zone: 'wake', time: '06:45', entries: [
          entry({ pantryItemId: 'a', name: 'A', taken: true }),
          entry({ pantryItemId: 'b', name: 'B' }),
        ],
      })],
      [], ANCHORS,
    )
    expect(bands[0].doneCount).toBe(1)
    expect(bands[0].rows).toHaveLength(2)
  })

  test('adag nélküli tétel adag nélkül jön vissza', () => {
    const bands = groupStackByBand(
      [slot({ zone: 'wake', time: '06:45', entries: [entry({ pantryItemId: 'x', name: 'X', dose: null })] })],
      [], ANCHORS,
    )
    expect(bands[0].rows[0].dose).toBeNull()
  })

  test('a ma kimaradó tétel nem kerül a sávba', () => {
    const bands = groupStackByBand(
      [slot({ zone: 'wake', time: '06:45', entries: [entry({ pantryItemId: 'x', name: 'X', skippedToday: true })] })],
      [], ANCHORS,
    )
    expect(bands).toEqual([])
  })
})

describe('nextDueBand', () => {
  test('a most esedékes sáv a legkorábbi befejezetlen', () => {
    const morningTaken = SLOTS.map((s, i) => (i === 0
      ? slot({ ...s, entries: [entry({ pantryItemId: 'kreatin', name: 'Kreatin', taken: true })] })
      : s))
    expect(nextDueBand(groupStackByBand(morningTaken, [], ANCHORS))).toBe('midday')
  })

  test('minden bevéve — nincs esedékes sáv', () => {
    const allTaken = SLOTS.map(s => slot({
      ...s, entries: s.entries.map(e => ({ ...e, taken: true })),
    }))
    expect(nextDueBand(groupStackByBand(allTaken, [], ANCHORS))).toBeNull()
  })

  test('üres listán nincs esedékes sáv', () => {
    expect(nextDueBand([])).toBeNull()
  })
})
