import { describe, expect, test } from 'vitest'
import { STAT_DECK, dailyStatIndex } from '@/features/me/logic/sleepEducation'

describe('STAT_DECK', () => {
  test('has exactly 7 cards with unique keys and full copy', () => {
    expect(STAT_DECK).toHaveLength(7)
    expect(new Set(STAT_DECK.map((s) => s.key)).size).toBe(7)
    for (const s of STAT_DECK) {
      expect(s.title.length).toBeGreaterThan(0)
      expect(s.text.length).toBeGreaterThan(0)
      expect(s.source.length).toBeGreaterThan(0)
    }
  })
  test('the heavy clinical stats are NOT in the rotating deck', () => {
    const all = STAT_DECK.map((s) => s.title + s.text).join(' ')
    expect(all).not.toMatch(/öngyilkos/i)
    expect(all).not.toMatch(/rémálm/i)
  })
})

describe('dailyStatIndex', () => {
  test('is deterministic per date and changes across days', () => {
    expect(dailyStatIndex('2026-07-24')).toBe(1) // 20260724 % 7
    expect(dailyStatIndex('2026-07-25')).toBe(2)
    expect(dailyStatIndex('2026-07-24')).toBe(dailyStatIndex('2026-07-24'))
  })
  test('wraps with the modulus', () => {
    expect(dailyStatIndex('2026-07-24', 3)).toBe(20260724 % 3)
  })
})
