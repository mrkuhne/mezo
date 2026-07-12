import { describe, expect, test } from 'vitest'
import { buildGrowthJournal, dayLabel } from '@/features/me/logic/growthJournal'
import type { ActivityEntry, DailyQuest } from '@/data/types'

const quest = (overrides: Partial<DailyQuest> = {}): DailyQuest => ({
  id: 'q', questDate: '2026-07-11', slot: 'BODY', skillKey: 'strength_endurance',
  title: 'Teszt küldetés', why: 'Teszt indoklás.', targetLabel: 'Teszt cél',
  xp: 25, status: 'completed', completionMode: 'DERIVED', completedAt: '2026-07-11T18:00:00Z',
  ...overrides,
})

const activity = (overrides: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id: 'a', occurredOn: '2026-07-11', text: 'Teszt tevékenység', skillKey: 'learning',
  confidence: 0.9, xpAwarded: 10, durationMin: null, amountHuf: null,
  categorizedBy: 'AI', createdAt: '2026-07-11T09:00:00Z',
  ...overrides,
})

const TODAY = '2026-07-12'

describe('buildGrowthJournal', () => {
  test('groups quests + activities by day, newest first', () => {
    const days = buildGrowthJournal(
      [
        quest({ id: 'q1', questDate: '2026-07-10' }),
        quest({ id: 'q2', questDate: '2026-07-11' }),
      ],
      [
        activity({ id: 'a1', occurredOn: '2026-07-11' }),
        activity({ id: 'a2', occurredOn: '2026-07-09' }),
      ],
      TODAY,
    )
    expect(days.map((d) => d.date)).toEqual(['2026-07-11', '2026-07-10', '2026-07-09'])
    // The 07-11 group carries both its quest and its activity.
    const day11 = days.find((d) => d.date === '2026-07-11')!
    expect(day11.entries.map((e) => (e.kind === 'quest' ? e.quest.id : e.activity.id))).toEqual(['q2', 'a1'])
  })

  test('excludes still-live offered/rerolled quests', () => {
    const days = buildGrowthJournal(
      [
        quest({ id: 'offered', status: 'offered' }),
        quest({ id: 'rerolled', status: 'rerolled' }),
        quest({ id: 'done', status: 'completed' }),
      ],
      [],
      TODAY,
    )
    expect(days).toHaveLength(1)
    expect(days[0].entries).toHaveLength(1)
    expect(days[0].entries[0]).toEqual({ kind: 'quest', quest: expect.objectContaining({ id: 'done' }) })
  })

  test('xpTotal sums completed-quest xp + activity xpAwarded; expired quests contribute 0', () => {
    const days = buildGrowthJournal(
      [
        quest({ id: 'c', status: 'completed', xp: 25 }),
        quest({ id: 'e', status: 'expired', xp: 20 }),
      ],
      [activity({ id: 'a1', xpAwarded: 10 })],
      TODAY,
    )
    expect(days).toHaveLength(1)
    expect(days[0].xpTotal).toBe(35) // 25 (completed) + 0 (expired) + 10 (activity)
  })
})

describe('dayLabel', () => {
  test('returns Ma / Tegnap / HU month-day relative to today', () => {
    expect(dayLabel('2026-07-12', TODAY)).toBe('Ma')
    expect(dayLabel('2026-07-11', TODAY)).toBe('Tegnap')
    expect(dayLabel('2026-07-10', TODAY)).toBe('Júl 10')
  })

  test('Tegnap survives the Europe/Budapest spring-forward DST day (23h)', () => {
    // 2026-03-29 is the CET→CEST spring-forward Sunday (only 23h long); the naive
    // exact-86.4M-ms check misfires in a CET/CEST environment. The whole-day-distance
    // rounding makes the label environment-independent.
    expect(dayLabel('2026-03-29', '2026-03-30')).toBe('Tegnap')
  })
})
