// Deterministic seeded LevelUpResult fixtures for mock mode: the no-op finish /
// sport / run mutations can't compute a real payload, so they return one of
// these. Values are fixed (no Date / Math.random) for stable tests + parity.
import type { LevelUpResult } from '@/lib/trainApi'

/** Rich gym case: 2 level-ups (a muscle + max_strength), a perk, more gains, streak. */
export const gymLevelUpMock: LevelUpResult = {
  source: 'GYM',
  workoutLabel: 'Klasszik kondi',
  durationMin: 58,
  rpe: 8,
  totalXp: 480,
  gains: [
    { skillKey: 'chest', kind: 'MUSCLE', name: 'chest', xpGained: 120, levelBefore: 5, levelAfter: 6, progressFromPct: 80, progressToPct: 22 },
    { skillKey: 'max_strength', kind: 'ATHLETIC', name: 'max_strength', xpGained: 150, levelBefore: 6, levelAfter: 7, progressFromPct: 78, progressToPct: 18 },
    { skillKey: 'strength_endurance', kind: 'ATHLETIC', name: 'strength_endurance', xpGained: 70, levelBefore: 5, levelAfter: 5, progressFromPct: 42, progressToPct: 60 },
    { skillKey: 'shoulder', kind: 'MUSCLE', name: 'shoulder', xpGained: 90, levelBefore: 4, levelAfter: 4, progressFromPct: 55, progressToPct: 72 },
    { skillKey: 'triceps', kind: 'MUSCLE', name: 'triceps', xpGained: 50, levelBefore: 3, levelAfter: 3, progressFromPct: 40, progressToPct: 54 },
  ],
  levelUps: ['chest', 'max_strength'],
  perks: [
    { skillKey: 'max_strength', perkKey: 'iron_core_2', name: 'Vas-törzs II', effectCopy: 'push-volumen tűrés +6%', milestoneLevel: 5 },
  ],
  robustness: { xpGained: 25, streakWeeks: 5 },
}

/** No-level-up case (the common one): XP accrued, nothing leveled, no perks. */
export const runLevelUpMock: LevelUpResult = {
  source: 'RUN',
  workoutLabel: 'Sprint futás',
  durationMin: 32,
  rpe: 9,
  totalXp: 180,
  gains: [
    { skillKey: 'sprint_speed', kind: 'ATHLETIC', name: 'sprint_speed', xpGained: 100, levelBefore: 3, levelAfter: 3, progressFromPct: 20, progressToPct: 52 },
    { skillKey: 'anaerobic_capacity', kind: 'ATHLETIC', name: 'anaerobic_capacity', xpGained: 60, levelBefore: 4, levelAfter: 4, progressFromPct: 40, progressToPct: 58 },
    { skillKey: 'explosiveness', kind: 'ATHLETIC', name: 'explosiveness', xpGained: 20, levelBefore: 4, levelAfter: 4, progressFromPct: 60, progressToPct: 66 },
  ],
  levelUps: [],
  perks: [],
  robustness: { xpGained: 25, streakWeeks: 5 },
}

/** Single athletic level-up (volleyball). */
export const sportLevelUpMock: LevelUpResult = {
  source: 'SPORT',
  workoutLabel: 'Röplabda',
  durationMin: 90,
  rpe: 7,
  totalXp: 240,
  gains: [
    { skillKey: 'vertical_jump', kind: 'ATHLETIC', name: 'vertical_jump', xpGained: 90, levelBefore: 3, levelAfter: 4, progressFromPct: 85, progressToPct: 12 },
    { skillKey: 'agility', kind: 'ATHLETIC', name: 'agility', xpGained: 60, levelBefore: 3, levelAfter: 3, progressFromPct: 44, progressToPct: 60 },
    { skillKey: 'coordination', kind: 'ATHLETIC', name: 'coordination', xpGained: 60, levelBefore: 3, levelAfter: 3, progressFromPct: 38, progressToPct: 54 },
    { skillKey: 'aerobic_capacity', kind: 'ATHLETIC', name: 'aerobic_capacity', xpGained: 30, levelBefore: 5, levelAfter: 5, progressFromPct: 66, progressToPct: 74 },
  ],
  levelUps: ['vertical_jump'],
  perks: [],
  robustness: { xpGained: 25, streakWeeks: 5 },
}
