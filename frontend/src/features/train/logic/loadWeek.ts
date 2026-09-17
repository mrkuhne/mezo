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
import type { RunPrescribedSession } from '@/data/train/runningApi'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'

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

/**
 * The map's OWN heat — 'done' mode, but honest about what "already worked" means.
 * `heatRows` folds TONIGHT's plan in (so 'entering' — "today's session crosses the
 * floor" — is reachable), but that unlogged plan must never inflate a group all the
 * way to 'over': the map's caption ("ami már dolgozott") promises logged work only,
 * so 'over' is kept ONLY when the LOGGED-only rows (`doneRows`, no today's plan)
 * already cross the budget on their own. 'entering' is untouched — mapHeat's own
 * doneSets===0 collapse already keeps it from firing on a plan with nothing logged.
 */
export function mapWeekHeat(doneRows: WeekZoneRow[], heatRows: WeekZoneRow[]): BodyHeat[] {
  const doneByGroup = new Map(doneRows.map((r) => [r.group, r]))
  const honestRows = heatRows.map((hr) => {
    if (hr.status !== 'over') return hr
    const logged = doneByGroup.get(hr.group)
    return logged?.status === 'over' ? hr : { ...hr, status: logged?.status ?? 'below' }
  })
  return mapHeat(honestRows, 'done')
}

/** Groups the plan asked for that got zero live work yet — the most actionable list on screen. */
export function untouchedMuscles(rows: WeekZoneRow[]): Array<{ label: string; plannedSets: number; colorMuscle: string }> {
  return rows
    .filter((r) => r.plannedSets > 0 && r.doneSets === 0)
    .sort((a, b) => b.plannedSets - a.plannedSets || a.label.localeCompare(b.label))
    .map((r) => ({ label: r.label, plannedSets: r.plannedSets, colorMuscle: r.colorMuscle }))
}

/**
 * The muscle TOKENS this week's LOGGED work actually touched (mezo-lf3cv, P2 Task 1) —
 * the „Minden izomjel" screen's only source of truth for a lit cell. Deliberately
 * per-token (not per budget group, the way `weekZoneRows` aggregates): the screen lights
 * one cell per catalog muscle, so a group-level aggregate would light siblings that were
 * never worked. Same honesty cuts the logged path of `weekZoneRows` applies (weekZone.ts:66):
 * plyo exercises never count, and a set only counts when it is a real, un-skipped working
 * set. A token this week's log cannot speak for is simply absent from the set — the caller
 * renders it unlit rather than guessing.
 */
export function workedMusclesThisWeek(details: WorkoutDetailResponse[]): Set<string> {
  const worked = new Set<string>()
  for (const w of details) {
    for (const wx of w.exercises) {
      if (wx.type === 'plyo' || !wx.muscle) continue
      const counted = wx.sets.some((s) => !s.skipped && (s.kind ?? 'working') === 'working')
      if (counted) worked.add(wx.muscle)
    }
  }
  return worked
}

/**
 * Total run minutes across the week's prescribed sessions — real clock time from every
 * segment (warmup/work/rest/cooldown alike, sprint's rest included), not just the "work"
 * slices growthForecast's XP math cares about. A runner-only user's card must count this
 * alongside sportSlots' minutes, or the headline reads "0 perc sport" while a whole
 * running plan sits in the week.
 */
export function runMinutesForWeek(runSessions: RunPrescribedSession[]): number {
  return runSessions.reduce(
    (total, s) => total + Math.round(s.segments.reduce((t, seg) => t + seg.durationSec, 0) / 60),
    0,
  )
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
 * contributes 0 known MINUTES (there is genuinely nothing to sum) but a NULL kcal — 0 kcal
 * would read as "we measured zero calories", which is a fabrication for a side with no
 * blocks/sessions at all (fix round 2, mezo-88iwa.13 review: caught as "sport · 0 kcal —
 * naplóztad" rendering with nothing logged). `known` still stays true for an empty side —
 * emptiness is itself a known, honest state — so it never drags the other, present side
 * into `known: false`.
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
  const gymKcal = gymBlocks.length === 0 ? null : gymEnergy.known ? gymEnergy.plannedKcal : null

  const sportKnown = sport.every((s) => s.kcal !== null)
  const sportKcal = sport.length === 0 ? null : sportKnown ? sport.reduce((t, s) => t + (s.kcal ?? 0), 0) : null

  return {
    gymMin, sportMin, totalMin: gymMin + sportMin,
    gymKcal, sportKcal, known: gymKnown && sportKnown,
  }
}
