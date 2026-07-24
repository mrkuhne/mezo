// ============================================================
// Mezo · prepBriefing — pure view-data adapters for the prep mission-briefing screen
// (mezo-bxpg). Adapts EXISTING engines into prep view data: wraps a WorkoutPlan as a
// single-day growthForecast input, and derives the records-idiom (catalogId-else-name)
// e1RM lookup. Pure functions only — no hooks, no fetching. Honest semantics: unknown
// numbers are omitted/null, never fabricated.
// ============================================================
import type { GymExercise, LoggedWorkoutExercise, MesoDay, WorkoutPlan } from '@/data/types'
import type { SkillLevel } from '@/data/progression/progressionApi'
import type { ExerciseRecordResponse } from '@/data/train/trainApi'
import { growthForecast, type ForecastSkill } from '@/features/train/logic/growthForecast'

export interface PrepStats {
  workSets: number
  warmupSets: number
  repsEst: number
  durationEst: number
  muscleCount: number
}

/** First working prescribed target weight, or null (plyo / no anchor / switch off).
 * This is the engine's TODAY recommendation (used for the display pill) — distinct
 * from `e.anchorWeightKg`, the established anchor `pseudoDayFromPlan` forecasts from. */
export function startWeightOf(e: LoggedWorkoutExercise): number | null {
  return e.prescribedSets?.find((p) => p.kind === 'working')?.targetWeightKg ?? null
}

export function prepStats(W: WorkoutPlan): PrepStats {
  let workSets = 0
  let warmupSets = 0
  let repsEst = 0
  const muscles = new Set<string>()
  for (const e of W.exercises) {
    workSets += e.workingSets
    warmupSets += e.warmupSets
    repsEst += e.workingSets * Math.round((e.repMin + e.repMax) / 2)
    if (e.muscle && e.muscle !== 'sport') muscles.add(e.muscle)
  }
  return { workSets, warmupSets, repsEst, durationEst: W.durationEst, muscleCount: muscles.size }
}

/** MesoDay adapter so growthForecast can score ONE workout (meso day or custom/saját plan). */
export function pseudoDayFromPlan(W: WorkoutPlan): MesoDay {
  const exercises: GymExercise[] = W.exercises.map((e) => ({
    id: e.id,
    name: e.name,
    muscle: e.muscle,
    warmupSets: e.warmupSets,
    workingSets: e.workingSets,
    repMin: e.repMin,
    repMax: e.repMax,
    targetRIR: e.targetRIR,
    type: e.type,
    anchorWeightKg: e.anchorWeightKg ?? null,
  }))
  return { day: '', type: W.title, muscle: '', exerciseCount: exercises.length, exercises }
}

export interface PrepForecast { totalXp: number; skills: ForecastSkill[] }

export function prepForecast(day: MesoDay, athletic: SkillLevel[]): PrepForecast {
  const forecast = growthForecast({ days: [day], slots: [], runSessions: [], athletic })
  const skillXp = forecast.skills.reduce((sum, s) => sum + s.xpEst, 0)
  const muscleXp = Object.values(forecast.muscleXp).reduce((sum, xp) => sum + xp, 0)
  return { totalXp: skillXp + muscleXp, skills: forecast.skills.slice(0, 3) }
}

/** catalogId-else-name identity key — 'c:'+id when catalog-linked, else 'n:'+name. */
export function identityKeyOf(ex: { catalogId?: string | null; name: string }): string {
  return ex.catalogId ? `c:${ex.catalogId}` : `n:${ex.name}`
}

/** catalogId-else-name identity → best e1RM kg (rounded), the records idiom. Records
 * without a bestE1rm (bodyweight-only exercises) are omitted — never fabricated. */
export function oneRmByIdentity(records: ExerciseRecordResponse[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of records) {
    if (r.bestE1rm) map.set(identityKeyOf(r), Math.round(r.bestE1rm.value))
  }
  return map
}
