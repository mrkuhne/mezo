// ============================================================
// Mezo · loadWeek — the week's load, one honest module (Train Titanium T12
// "Terhelés" face, spec 2026-09-15). Sits on top of weekZoneRows (the week's
// per-group done/today/plan aggregation) plus sportLoadForWeek and reuses
// trainDayEnergy's MET math for the combined-movement summary. Zero UI
// imports — pure module, table-tested.
//
// Contract-check outcome (task 1, Step 1): countsTowardVolume lives on
// GymExercise (the PLAN side — frontend/src/data/types.ts:1231, MesoDay.exercises)
// but is ABSENT from WorkoutDetailExercise (the LOGGED/workout-detail wire shape —
// frontend/src/data/_client/api.gen.ts:5568, exposed as WorkoutDetailResponse in
// frontend/src/data/train/trainApi.ts:46: exerciseId/name/muscle/type/warmupSets/
// workingSets/repMin/repMax/targetRIR/skipped/sets only). weekZoneRows' logged
// path (weekZone.ts:66-76) can therefore only skip plyo by `type`, not any other
// exercise the plan marked countsTowardVolume:false — a logged non-counting
// exercise still moves its group's doneSets/doneBudget today. Filed mezo-og5rl
// to add the field server-side + generated types, then swap weekZone.ts's
// logged-path skip to countsForVolume(wx) with a table test. Not fixed here —
// no wire flag to key on yet.
// ============================================================
import type { Block } from '@/features/train/logic/trainDayEnergy'
import { trainDayEnergy } from '@/features/train/logic/trainDayEnergy'
import { REGION_LABELS, REGION_ORDER, muscleRegion } from '@/features/train/logic/muscleColors'
import type { SportLoadResult } from '@/features/train/logic/sportMuscleLoad'
import type { WeekZoneRow, WeekZoneStatus } from '@/features/train/logic/weekZone'
import type { BodyHeat } from '@/features/train/components/BodyMap'

export type LoadWeek = { doneSets: number; plannedSets: number; percent: number }

/** The week's load in three numbers — done, planned, and the honest share between them. */
export function loadWeekTotals(rows: WeekZoneRow[]): LoadWeek {
  const doneSets = rows.reduce((t, r) => t + r.doneSets, 0)
  const plannedSets = rows.reduce((t, r) => t + r.plannedSets, 0)
  const percent = plannedSets > 0
    ? Math.round(Math.min(1, doneSets / plannedSets) * 100)
    : doneSets > 0 ? 100 : 0
  return { doneSets, plannedSets, percent }
}

export type LoadGroupRow = {
  group: string
  label: string
  colorMuscle: string
  doneSets: number
  plannedSets: number
  status: WeekZoneStatus
  word: string
}

/** The three honest sentences a group's week can say — never a bare percentage. */
function wordFor(row: WeekZoneRow): string {
  const remaining = row.remainingPlanSets
  if (remaining === 0) return 'ez a hét itt már megvan'
  if (row.doneSets === 0) return 'erre a hét második fele épül'
  return `még ${remaining} szett van hátra`
}

/** Per-group load rows, biggest done contribution first (ties: heaviest plan). */
export function loadGroups(rows: WeekZoneRow[]): LoadGroupRow[] {
  return [...rows]
    .sort((a, b) => b.doneSets - a.doneSets || b.plannedSets - a.plannedSets || a.group.localeCompare(b.group))
    .map((r) => ({
      group: r.group, label: r.label, colorMuscle: r.colorMuscle,
      doneSets: r.doneSets, plannedSets: r.plannedSets, status: r.status,
      word: wordFor(r),
    }))
}

export type MapMode = 'done' | 'planned'

/** The plan's own bucket for a group — same status vocabulary, scaled by planBudget/plannedSets
 *  rather than the live doneSets. Never fabricates a bucket for an untouched-by-plan group. */
function plannedLevel(row: WeekZoneRow): BodyHeat['level'] {
  if (row.plannedSets === 0) return 'none'
  if (row.planBudget > 1) return 'over'
  if (row.mev === null) return 'in'
  return row.plannedSets >= row.mev ? 'in' : 'below'
}

/**
 * BodyMap heat rows: `done` reads each row's own live status (doneSets===0 → 'none');
 * `planned` reads the plan's own bucket via plannedLevel — every muscle group the week
 * touches (done, today, or plan) is present, none fabricated for groups it never reached.
 */
export function mapHeat(rows: WeekZoneRow[], mode: MapMode): BodyHeat[] {
  return rows.map((r) => ({
    token: r.colorMuscle,
    level: mode === 'done' ? (r.doneSets === 0 ? 'none' : r.status) : plannedLevel(r),
  }))
}

/** Groups the plan asked for that got zero live work yet — the most actionable list on screen. */
export function untouchedMuscles(rows: WeekZoneRow[]): Array<{ label: string; plannedSets: number; colorMuscle: string }> {
  return rows
    .filter((r) => r.plannedSets > 0 && r.doneSets === 0)
    .sort((a, b) => b.plannedSets - a.plannedSets || a.label.localeCompare(b.label))
    .map((r) => ({ label: r.label, plannedSets: r.plannedSets, colorMuscle: r.colorMuscle }))
}

/** Which region labels the week's sport touched at all — an estimate, never claimed exact. */
export function sportReach(load: SportLoadResult): string[] {
  const regions = new Set(
    Object.keys(load.perMuscle)
      .map((muscle) => muscleRegion(muscle))
      .filter((r): r is NonNullable<typeof r> => r !== null),
  )
  return REGION_ORDER.filter((r) => regions.has(r)).map((r) => REGION_LABELS[r])
}

export type MovementWeek = {
  gymMin: number; sportMin: number; totalMin: number
  gymKcal: number | null; sportKcal: number | null; known: boolean
}

/**
 * Every movement of the week in one place: gym kcal reuses trainDayEnergy's MET math and
 * its honesty rule (unknown weight → unknown kcal, never a fabricated number); sport kcal
 * is whatever was logged (unknown when any session came back without one). An empty side
 * contributes 0 known minutes/kcal — it never drags the other, present side into unknown.
 */
export function movementWeek(
  gymBlocks: Block[],
  sport: { minutes: number; kcal: number | null }[],
  weightKg: number | null,
): MovementWeek {
  const gymMin = gymBlocks.reduce((t, b) => t + b.minutes, 0)
  const sportMin = sport.reduce((t, s) => t + s.minutes, 0)

  const gymEnergy = trainDayEnergy(gymBlocks, weightKg)
  const gymKnown = gymBlocks.length === 0 || gymEnergy.known
  const gymKcal = gymBlocks.length === 0 ? 0 : gymEnergy.known ? gymEnergy.plannedKcal : null

  const sportKnown = sport.every((s) => s.kcal !== null)
  const sportKcal = sport.length === 0 ? 0 : sportKnown ? sport.reduce((t, s) => t + (s.kcal ?? 0), 0) : null

  return {
    gymMin, sportMin, totalMin: gymMin + sportMin,
    gymKcal, sportKcal, known: gymKnown && sportKnown,
  }
}
