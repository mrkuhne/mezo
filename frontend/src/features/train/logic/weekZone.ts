// ============================================================
// Mezo · weekZone — live weekly zone rows for mid-cycle surfaces
// (mezo-oyhy.7, spec 2026-08-04). Projects the week's LOGGED sets
// (completed workout instances, meso + custom), TODAY's session plan,
// and the weekly meso plan onto the shared budget scale (budgetOf
// units, GROUP_MEV zone floors from setBudget). Pure derivations —
// consumed by WeekZoneCard (prep screen) and ZoneMiniGrid (GymPage).
// Logged sets price by their own RIR (fallback: exercise targetRIR);
// skip-marker and warmup rows are excluded, plyo exercises never count.
// GD5 (mezo-3m5m) reframed muscleBudgets' own row.budget/level to be
// TIER-relative (the budget card's scale) — this view intentionally stays
// on the fatigue scale, so it recomputes planBudget via budgetOf(failureSets,
// volumeSets) from the row rather than reading row.budget/row.level.
// ============================================================
import type { ExerciseKind, MesoDay } from '@/data/types'
import type { WorkoutDetailResponse } from '@/data/train/trainApi'
import {
  BUDGET_GROUP_LABELS, GROUP_MEV, budgetGroup, budgetOf, muscleBudgets, setStyle,
} from '@/features/train/logic/setBudget'

export interface ZoneSegment { pct: number; kind: 'solid' | 'today' | 'ghost' | 'overflow' }

export interface TodayPlanExercise { muscle: string; type: ExerciseKind; workingSets: number; targetRIR: number }

export type WeekZoneStatus = 'below' | 'entering' | 'in' | 'over'

export interface WeekZoneRow {
  group: string
  label: string
  /** Representative catalog muscle key — feed muscleColor(). */
  colorMuscle: string
  mev: number | null
  /** Green-zone start on the budget scale (0..1); null when mev is. */
  zoneStart: number | null
  doneSets: number
  todaySets: number
  plannedSets: number
  doneBudget: number
  todayBudget: number
  planBudget: number
  /** Working sets the week's PLAN still holds after done+today — what's yet to come. */
  remainingPlanSets: number
  /**
   * Sets still missing to MEV once the WHOLE week's plan is counted (0 = the plan
   * gets there on its own). Mirrors MuscleBudgetRow.setsToZone, so a `below` row with
   * setsToZone 0 is merely early in the week — not under-planned (mezo-zr6p).
   */
  setsToZone: number
  status: WeekZoneStatus
}

interface StyleAcc { failure: number; volume: number; colorMuscle: string }

function bump(map: Map<string, StyleAcc>, group: string, muscle: string, style: 'failure' | 'volume', sets: number) {
  let acc = map.get(group)
  if (!acc) { acc = { failure: 0, volume: 0, colorMuscle: muscle }; map.set(group, acc) }
  acc[style] += sets
}

export function weekZoneRows({ plannedDays, completed, todayPlan }: {
  plannedDays: MesoDay[]
  completed: WorkoutDetailResponse[]
  todayPlan?: TodayPlanExercise[] | null
}): WeekZoneRow[] {
  const done = new Map<string, StyleAcc>()
  for (const w of completed) {
    for (const wx of w.exercises) {
      if (wx.type === 'plyo') continue
      const group = budgetGroup(wx.muscle)
      if (!group) continue
      for (const s of wx.sets) {
        if (s.skipped || (s.kind ?? 'working') !== 'working') continue
        bump(done, group, wx.muscle, setStyle(s.rir ?? wx.targetRIR), 1)
      }
    }
  }

  const today = new Map<string, StyleAcc>()
  for (const tx of todayPlan ?? []) {
    if (tx.type === 'plyo') continue
    const group = budgetGroup(tx.muscle)
    if (!group) continue
    bump(today, group, tx.muscle, setStyle(tx.targetRIR), tx.workingSets)
  }

  const plan = new Map(muscleBudgets(plannedDays).map((r) => [r.group, r]))

  const groups = new Set([...done.keys(), ...today.keys(), ...plan.keys()])
  return [...groups].map((group) => {
    const d = done.get(group)
    const t = today.get(group)
    const p = plan.get(group)
    const doneSets = d ? d.failure + d.volume : 0
    const todaySets = t ? t.failure + t.volume : 0
    const plannedSets = p?.workingSets ?? 0
    const doneBudget = d ? budgetOf(d.failure, d.volume) : 0
    const todayBudget = t ? budgetOf(t.failure, t.volume) : 0
    // p.budget is tier-relative since mezo-3m5m (spec GD5, the budget CARD's own scale) — this
    // view stays on the fatigue scale (GD5 reframes only the budget card, not weekZone), so
    // recompute it the same way done/todayBudget are, straight from the row's failure/volume split.
    const planBudget = p ? budgetOf(p.failureSets, p.volumeSets) : 0
    const mev = GROUP_MEV[group] ?? null
    // Zone floor projected with the week PLAN's style mix; plan-less (custom-only)
    // groups fall back to the live done+today mix.
    const refSets = plannedSets > 0 ? plannedSets : doneSets + todaySets
    const refBudget = plannedSets > 0 ? planBudget : doneBudget + todayBudget
    const zoneStart = mev !== null && refSets > 0 ? Math.min(1, (refBudget * mev) / refSets) : null
    const liveBudget = doneBudget + todayBudget
    // The week's own outlook: what the plan still owes, and whether plan + live work
    // clears the MEV floor at all. `below` says "not there YET"; setsToZone > 0 is the
    // stronger "the week as planned never gets there" (the planner's `under` level).
    const remainingPlanSets = Math.max(0, plannedSets - doneSets - todaySets)
    const projectedSets = Math.max(plannedSets, doneSets + todaySets)
    const setsToZone = mev === null ? 0 : Math.max(0, mev - projectedSets)
    const status: WeekZoneStatus =
      liveBudget > 1 ? 'over'
        : mev === null ? 'in'
          : doneSets >= mev ? 'in'
            : doneSets + todaySets >= mev ? 'entering'
              : 'below'
    return {
      group,
      label: BUDGET_GROUP_LABELS[group] ?? group,
      colorMuscle: p?.colorMuscle ?? d?.colorMuscle ?? t?.colorMuscle ?? group,
      mev, zoneStart, doneSets, todaySets, plannedSets, doneBudget, todayBudget, planBudget,
      remainingPlanSets, setsToZone, status,
    }
  })
}

/** Prep card rows: groups trained today, biggest contribution first. */
export function selectPrepRows(rows: WeekZoneRow[]): WeekZoneRow[] {
  return rows
    .filter((r) => r.todaySets > 0)
    .sort((a, b) => b.todaySets - a.todaySets || a.group.localeCompare(b.group))
}

/** GYM meta-card rows: every planned or already-trained group, heaviest plan first. */
export function selectGymRows(rows: WeekZoneRow[]): WeekZoneRow[] {
  return rows
    .filter((r) => r.plannedSets > 0 || r.doneSets > 0)
    .sort((a, b) => b.planBudget - a.planBudget || a.group.localeCompare(b.group))
}

/** done → today → remaining-plan segments; caps at 100%, over turns the today slice into overflow. */
export function prepSegments(row: WeekZoneRow): ZoneSegment[] {
  const done = Math.min(row.doneBudget, 1)
  const live = Math.min(row.doneBudget + row.todayBudget, 1)
  const today = live - done
  const plan = Math.max(0, Math.min(row.planBudget, 1) - live)
  const segs: ZoneSegment[] = []
  if (done > 0) segs.push({ pct: done, kind: 'solid' })
  if (today > 0) segs.push({ pct: today, kind: row.status === 'over' ? 'overflow' : 'today' })
  if (plan > 0) segs.push({ pct: plan, kind: 'ghost' })
  return segs
}

/** done → remaining-plan segments for the GYM mini bars (no today slice). */
export function gymSegments(row: WeekZoneRow): ZoneSegment[] {
  const done = Math.min(row.doneBudget, 1)
  const plan = Math.max(0, Math.min(row.planBudget, 1) - done)
  const segs: ZoneSegment[] = []
  if (done > 0) segs.push({ pct: done, kind: row.doneBudget > 1 ? 'overflow' : 'solid' })
  if (plan > 0) segs.push({ pct: plan, kind: 'ghost' })
  return segs
}
