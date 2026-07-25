import type { GamificationDay } from '@/data/gamification/gamificationTypes'

/**
 * Deterministic day seed for the Harvest read (mezo-huzd R3), matching the approved
 * mockup numbers: QUEST 45 / HABIT 35 / ACTIVITY 15 / GYM 20 → 115 XP; coins `quest`
 * +10 and `all3` +20 → 30 coins; a 12-day alive streak.
 */
export function mockGamificationDay(date: string): GamificationDay {
  return {
    date,
    xpBySource: [
      { source: 'QUEST', xp: 45 },
      { source: 'HABIT', xp: 35 },
      { source: 'ACTIVITY', xp: 15 },
      { source: 'GYM', xp: 20 },
    ],
    xpTotal: 115,
    coinEvents: [
      { reason: 'quest', amount: 10 },
      { reason: 'all3', amount: 20 },
    ],
    coinTotal: 30,
    streakDays: 12,
    streakAlive: true,
  }
}
