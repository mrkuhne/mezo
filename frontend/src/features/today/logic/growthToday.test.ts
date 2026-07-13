import { describe, expect, test } from 'vitest'
import { growthTodaySummary } from '@/features/today/logic/growthToday'
import type { ActivityEntry, DailyQuest } from '@/data/types'

const quest = (overrides: Partial<DailyQuest> = {}): DailyQuest => ({
  id: 'q', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
  title: 'Teszt küldetés', why: 'Teszt indoklás.', targetLabel: 'Teszt cél',
  xp: 25, status: 'offered', completionMode: 'DERIVED',
  ...overrides,
})

const activity = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 'a', occurredOn: '2026-07-11', text: 'Teszt tevékenység', skillKey: 'learning',
  confidence: 0.9, xpAwarded: 10, durationMin: null, amountHuf: null,
  categorizedBy: 'AI', createdAt: '2026-07-11T09:00:00Z',
  ...overrides,
})

describe('growthTodaySummary', () => {
  test('1 done of 3 quests at 15 XP + one awarded 18 XP activity -> done 1, total 3, xp 33', () => {
    const quests = [
      quest({ id: 'q1', status: 'completed', xp: 15 }),
      quest({ id: 'q2', status: 'offered', xp: 25 }),
      quest({ id: 'q3', status: 'offered', xp: 20 }),
    ]
    const entries = [activity({ id: 'a1', xpAwarded: 18 })]
    expect(growthTodaySummary(quests, entries)).toEqual({ done: 1, total: 3, xp: 33 })
  })

  test('expired/rerolled quests count toward total but not toward done or xp', () => {
    const quests = [
      quest({ id: 'q1', status: 'expired', xp: 20 }),
      quest({ id: 'q2', status: 'rerolled', xp: 15 }),
    ]
    expect(growthTodaySummary(quests, [])).toEqual({ done: 0, total: 2, xp: 0 })
  })

  test('sums xp across multiple completed quests and multiple activities', () => {
    const quests = [
      quest({ id: 'q1', status: 'completed', xp: 15 }),
      quest({ id: 'q2', status: 'completed', xp: 25 }),
    ]
    const entries = [
      activity({ id: 'a1', xpAwarded: 18 }),
      activity({ id: 'a2', xpAwarded: 15 }),
      activity({ id: 'a3', xpAwarded: 0 }),
    ]
    expect(growthTodaySummary(quests, entries)).toEqual({ done: 2, total: 2, xp: 73 })
  })

  test('empty inputs yield an all-zero summary', () => {
    expect(growthTodaySummary([], [])).toEqual({ done: 0, total: 0, xp: 0 })
  })
})
