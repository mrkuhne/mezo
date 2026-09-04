import type { components } from '@/data/_client/api.gen'
import { addDays } from '@/shared/lib/dates'

export type MeWeek = components['schemas']['MeWeekResponse']
export type MeWeekDay = components['schemas']['MeWeekDay']
export type MeWeekAggregates = components['schemas']['MeWeekAggregates']

// One deterministic demo week (Monday 2026-05-18, mezo-p2tr) for the weekly review page —
// 5 dense days (full nutrition/quality/training/sleep/logging coverage) + 2 sparse days, one of
// which is a genuine "tanulom" day (score: null, no data logged at all). Sleep quality and
// checkin energy are 1–10 scales (see MeWeekDay.sleepQuality / checkinEnergyAvg).
// mezo-jcpt.5: `subscores` carries the napi motor hat dimenzióját (nutrition/quality/training/
// sleep/logging/rhythm); at least one day below leaves BOTH quality and rhythm null so the
// `is-none` stub still renders somewhere in the mock.
export const mockMeWeekStart = '2026-05-18'

const KCAL_TARGET = 3100
const PROTEIN_TARGET_G = 220

const SEED_DAYS: readonly MeWeekDay[] = [
  // Hét — dense: gym day, full logging
  {
    date: '2026-05-18',
    score: 78,
    subscores: { nutrition: 75, quality: 79, training: 88, sleep: 82, logging: 74, rhythm: 80 },
    kcal: 2980, proteinG: 212, carbsG: 335, fatG: 92,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: 84.3,
    sleepMin: 445, sleepQuality: 7,
    checkinCount: 4, checkinEnergyAvg: 7,
    workoutCount: 1, xp: 140,
  },
  // Kedd — dense: volleyball day
  {
    date: '2026-05-19',
    score: 72,
    subscores: { nutrition: 80, quality: 72, training: 78, sleep: 68, logging: 70, rhythm: 74 },
    kcal: 3050, proteinG: 218, carbsG: 360, fatG: 88,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: 84.2,
    sleepMin: 398, sleepQuality: 6,
    checkinCount: 4, checkinEnergyAvg: 6,
    workoutCount: 1, xp: 110,
  },
  // Szerda — dense: gym day, best sleep of the week
  {
    date: '2026-05-20',
    score: 85,
    subscores: { nutrition: 82, quality: 85, training: 90, sleep: 90, logging: 80, rhythm: 88 },
    kcal: 3120, proteinG: 225, carbsG: 355, fatG: 95,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: 84.1,
    sleepMin: 470, sleepQuality: 8,
    checkinCount: 4, checkinEnergyAvg: 8,
    workoutCount: 1, xp: 155,
  },
  // Csütörtök — sparse: only checkins logged, no sleep/fuel/workout data
  {
    date: '2026-05-21',
    score: null,
    subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: 65, rhythm: null },
    kcal: null, proteinG: null, carbsG: null, fatG: null,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: null,
    sleepMin: null, sleepQuality: null,
    checkinCount: 2, checkinEnergyAvg: 6,
    workoutCount: 0, xp: 20,
  },
  // Péntek — dense: gym day, lighter session
  {
    date: '2026-05-22',
    score: 74,
    subscores: { nutrition: 70, quality: 74, training: 80, sleep: 76, logging: 72, rhythm: 77 },
    kcal: 2870, proteinG: 198, carbsG: 320, fatG: 84,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: 84.0,
    sleepMin: 420, sleepQuality: 7,
    checkinCount: 3, checkinEnergyAvg: 7,
    workoutCount: 1, xp: 100,
  },
  // Szombat — "tanulom" day: genuinely no data logged at all
  {
    date: '2026-05-23',
    score: null,
    subscores: { nutrition: null, quality: null, training: null, sleep: null, logging: null, rhythm: null },
    kcal: null, proteinG: null, carbsG: null, fatG: null,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: null,
    sleepMin: null, sleepQuality: null,
    checkinCount: 0, checkinEnergyAvg: null,
    workoutCount: 0, xp: null,
  },
  // Vasárnap — dense: rest day, still logged
  {
    date: '2026-05-24',
    score: 80,
    subscores: { nutrition: 78, quality: 81, training: 82, sleep: 85, logging: 76, rhythm: 83 },
    kcal: 3000, proteinG: 205, carbsG: 340, fatG: 90,
    kcalTarget: KCAL_TARGET, proteinTargetG: PROTEIN_TARGET_G,
    weightKg: 83.9,
    sleepMin: 460, sleepQuality: 8,
    checkinCount: 4, checkinEnergyAvg: 7,
    workoutCount: 0, xp: 60,
  },
] as const

/** Days-between two ISO date strings (local, DST-safe). */
function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  const from = Date.UTC(fy, fm - 1, fd)
  const to = Date.UTC(ty, tm - 1, td)
  return Math.round((to - from) / 86_400_000)
}

/** The seed week re-dated to the requested Monday (`startIso`) — lets the mock page browse
 *  weeks while keeping the same shape of dense/sparse days regardless of which week is open. */
export function mockMeWeek(startIso: string): MeWeek {
  const shift = daysBetween(mockMeWeekStart, startIso)
  return {
    start: startIso,
    days: SEED_DAYS.map((d) => ({ ...d, date: addDays(d.date, shift) })),
    weekly: {
      score: 78,
      prevWeekScore: 74,
      avgKcal: 3004,
      avgProteinG: 212,
      avgSleepMin: 439,
      avgCheckinEnergy: 7,
      checkinRatio: 0.75,
      latestWeightKg: 83.9,
      weightWeeklyRateKg: -0.3,
      totalXp: 585,
    },
  }
}
