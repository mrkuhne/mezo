// Deterministic seeded LevelUpResult fixtures for mock mode: the no-op finish /
// sport / run mutations can't compute a real payload, so they return one of
// these. Values are fixed (no Date / Math.random) for stable tests + parity.
import type { LevelUpResult } from '@/data/train/trainApi'
import type { ProgressionProfileResponse } from '@/data/progression/progressionApi'

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

// --- Progression profile (P6) — seeded snapshot for mock mode + the ghost/real-empty value ---

const athleticLevels: Record<string, number> = {
  max_strength: 7, aerobic_capacity: 6, explosiveness: 5, anaerobic_capacity: 5, strength_endurance: 5,
  agility: 4, coordination: 4, vertical_jump: 4, core_stability: 4, sprint_speed: 3, mobility: 3,
}
const muscleLevels: Record<string, number> = {
  'back-mid': 6, quad: 6, chest: 6, glute: 5, ham: 5, shoulder: 5, lats: 4, biceps: 4,
  triceps: 4, core: 4, traps: 3, 'rear-delt': 3, calf: 2,
}
const skill = (skillKey: string, kind: 'ATHLETIC' | 'MUSCLE', level: number, progressPct: number) =>
  ({ skillKey, kind, level, cumulativeXp: level * 150, progressPct })

/** Seeded profile snapshot for mock mode (the FE can't derive levels — no logged history). */
export const progressionProfileMock: ProgressionProfileResponse = {
  athleteLevel: 4.3,
  streakWeeks: 5,
  athletic: Object.entries(athleticLevels).map(([k, lv], i) => skill(k, 'ATHLETIC', lv, 30 + ((i * 13) % 60))),
  muscle: Object.entries(muscleLevels).map(([k, lv], i) => skill(k, 'MUSCLE', lv, 25 + ((i * 17) % 65))),
  radarAxes: [
    { axis: 'Erő', value: 6.8 },
    { axis: 'Robbanékonyság', value: 4.5 },
    { axis: 'Sebesség', value: 3.0 },
    { axis: 'Állóképesség', value: 5.5 },
    { axis: 'Mozgékonyság', value: 3.2 },
    { axis: 'Koordináció', value: 4.0 },
  ],
  highlights: {
    bestAthletic: { skillKey: 'max_strength', level: 7 },
    bestMuscle: { skillKey: 'back-mid', level: 6 },
  },
  life: [
    { skillKey: 'mindfulness', kind: 'LIFE', level: 1, cumulativeXp: 40, progressPct: 40 },
    { skillKey: 'mindset', kind: 'LIFE', level: 2, cumulativeXp: 130, progressPct: 15.9 },
    { skillKey: 'cooking', kind: 'LIFE', level: 2, cumulativeXp: 150, progressPct: 26.5 },
    { skillKey: 'financial', kind: 'LIFE', level: 1, cumulativeXp: 55, progressPct: 55 },
    { skillKey: 'productivity', kind: 'LIFE', level: 1, cumulativeXp: 25, progressPct: 25 },
    { skillKey: 'learning', kind: 'LIFE', level: 3, cumulativeXp: 320, progressPct: 27.7 },
    { skillKey: 'connection', kind: 'LIFE', level: 1, cumulativeXp: 60, progressPct: 60 },
    { skillKey: 'recovery', kind: 'LIFE', level: 3, cumulativeXp: 305, progressPct: 22.4 },
  ],
  traits: { disciplinePct: 78, consistencyWeeks: 5 },
  savingsHuf30d: 50000,
}

/** Real-mode empty / ghost value (no XP yet, or progression switch off → 404). */
export const GHOST_PROGRESSION_PROFILE: ProgressionProfileResponse = {
  athleteLevel: null,
  streakWeeks: 0,
  athletic: [],
  muscle: [],
  radarAxes: [],
  highlights: {},
  life: [],
  traits: { disciplinePct: null, consistencyWeeks: 0 },
  savingsHuf30d: null,
}
