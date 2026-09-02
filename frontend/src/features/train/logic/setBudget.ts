// ============================================================
// Mezo · setBudget — planning-time weekly set-budget per muscle group
// (mezo-7rdg, spec 2026-08-01; reframed mezo-3m5m, spec GD5). Two models
// now coexist:
//  - The ORIGINAL fatigue-cap model (setStyle/budgetOf/FAILURE_WEEKLY_CAP/
//    VOLUME_WEEKLY_CAP/GROUP_MEV) — source: Built With Science video (yt
//    ehQ_5TThkRI, Zourdos/Remmert): failure style (RIR≤1) is productive up
//    to ~12 sets/muscle/week, volume style (RIR≥2) up to ~20. Still used
//    directly by weekZone.ts — kept verbatim here.
//  - The per-tier LANDMARK model (GROUP_LANDMARKS + muscleBudgets below):
//    each muscle group's weekly budget is now measured against its OWN
//    tier target (Maintain→MEV, Grow→MAV, Emphasize→MRV — see
//    logic/musclePriorities.ts) instead of the shared failure/volume caps.
//    This is what WeeklyBandsCard's rows display (wizard v2, mezo-d20.14 —
//    formerly SetBudgetCard's %-driven pill/rows).
// Beyond ~8 sets/muscle in ONE session extra sets don't add growth
// (SESSION_MUSCLE_CAP, tier-independent — tightened 11→8, mezo-d20.14).
// Pure client-side derivation from the meso days template — nothing persisted.
// Granularity is the coarse muscle group (chest/back/…): finer than the 6
// color regions (Kar/Láb would over-merge), coarser than the 21 heads.
// ============================================================
import type { ExerciseKind, MesoDay, MusclePriorities, MuscleTier } from '@/data/types'
import { isOffDay } from '@/features/train/logic/offDay'
import { tierOf, tierTargetOf } from '@/features/train/logic/musclePriorities'

/**
 * Does this exercise's work count as hypertrophy volume? The server sets the flag explicitly
 * (false for the fix-zárás closing block and plyo). When it is absent — mock fixtures, plans
 * written before mezo-gbo7 — fall back to the old rule so behaviour is unchanged.
 */
export function countsForVolume(ex: { countsTowardVolume?: boolean; type: ExerciseKind }): boolean {
  return ex.countsTowardVolume ?? ex.type !== 'plyo'
}

export type SetStyle = 'failure' | 'volume'
export const FAILURE_WEEKLY_CAP = 12
export const VOLUME_WEEKLY_CAP = 20
export const SESSION_MUSCLE_CAP = 8
export const NEAR_THRESHOLD = 0.85

// Weekly minimum-effective set counts per budget group — lower edges of the
// RP intermediate MEV ranges (docs/research/concepts/program-design-rules.md),
// conservative on purpose. traps/core are intentionally absent: RP treats
// their MEV as ~0 (indirect volume from rows/deadlifts/compounds covers them),
// so they never trigger the under-volume signal. "Starting points, not gospel."
// Invariant: every MEV must stay < NEAR_THRESHOLD × FAILURE_WEEKLY_CAP (≈10.2)
// so an 'under' row can never mask a 'near'/'over' budget state.
export const GROUP_MEV: Record<string, number> = {
  chest: 4, back: 10, quad: 4, ham: 2, glute: 6, shoulder: 6, biceps: 8, triceps: 4, calf: 4,
}

export function setStyle(targetRIR: number): SetStyle {
  return targetRIR <= 1 ? 'failure' : 'volume'
}

export type BudgetLevel = 'ok' | 'near' | 'over' | 'under'

export function budgetOf(failureSets: number, volumeSets: number): number {
  return failureSets / FAILURE_WEEKLY_CAP + volumeSets / VOLUME_WEEKLY_CAP
}

// Weekly volume landmarks per muscle group — MIRROR of application.yml
// mezo.volume.baselines (mezo-3m5m). The tier target for muscleBudgets below
// (Maintain→mev, Grow→mav, Emphasize→mrv, via tierTargetOf). traps/core are
// intentionally absent — same "no lower bound" treatment as GROUP_MEV.
export const GROUP_LANDMARKS: Record<string, { mev: number; mav: number; mrv: number }> = {
  chest: { mev: 8, mav: 14, mrv: 20 },
  back: { mev: 10, mav: 16, mrv: 22 },
  shoulder: { mev: 8, mav: 12, mrv: 18 },
  biceps: { mev: 6, mav: 10, mrv: 14 },
  triceps: { mev: 6, mav: 10, mrv: 14 },
  quad: { mev: 8, mav: 12, mrv: 18 },
  ham: { mev: 6, mav: 10, mrv: 14 },
  glute: { mev: 8, mav: 12, mrv: 18 },
  calf: { mev: 6, mav: 10, mrv: 16 },
}

// Catalog head / legacy key → coarse budget group. Off-day keys ('', 'sport') → null.
const BUDGET_GROUP: Record<string, string> = {
  'chest-upper': 'chest', 'chest-mid': 'chest', 'chest-lower': 'chest', chest: 'chest',
  'back-wide': 'back', 'back-mid': 'back', 'back-lower': 'back', lats: 'back', back: 'back',
  traps: 'traps',
  'shoulder-front': 'shoulder', 'shoulder-side': 'shoulder', 'shoulder-rear': 'shoulder',
  shoulder: 'shoulder', 'rear-delt': 'shoulder',
  'biceps-long': 'biceps', 'biceps-short': 'biceps', 'biceps-brachialis': 'biceps', biceps: 'biceps',
  'triceps-long': 'triceps', 'triceps-lateral': 'triceps', 'triceps-medial': 'triceps', triceps: 'triceps',
  quad: 'quad', ham: 'ham', glute: 'glute', calf: 'calf', core: 'core',
}

export const BUDGET_GROUP_LABELS: Record<string, string> = {
  chest: 'Mell', back: 'Hát', traps: 'Trapéz', shoulder: 'Váll', biceps: 'Bicepsz',
  triceps: 'Tricepsz', quad: 'Comb', ham: 'Hamstring', glute: 'Farizom', calf: 'Vádli', core: 'Core',
}

export function budgetGroup(muscle: string): string | null {
  return BUDGET_GROUP[muscle] ?? null
}

export interface MuscleBudgetRow {
  group: string
  label: string
  /** Representative catalog muscle key — feed muscleColor() for the family tokens. */
  colorMuscle: string
  failureSets: number
  volumeSets: number
  workingSets: number
  /** Sets that do not count toward the budget — reported separately for visibility. */
  exemptSets: number
  /** Tier driving `target` below; defaults to 'grow' when no priorities map picks it. */
  tier: MuscleTier
  /** Weekly landmark target for the tier (MEV/MAV/MRV via tierTargetOf); null when the
   *  group carries no landmark at all (traps/core — set-count-only display). */
  target: number | null
  /** workingSets / target; 1 = 100% of the tier target. null when target is null. */
  budget: number | null
  level: BudgetLevel
  /** Weekly minimum-effective sets for the group; null = no lower bound (traps/core). */
  mev: number | null
  /** Green-zone start on the budget scale (mev / target); null when either is. */
  zoneStart: number | null
  /** Non-exempt sets still missing to reach MEV; 0 when in zone or no lower bound. */
  setsToZone: number
  /** Least-loaded training day to add the missing sets on; only set for under rows. */
  suggestedDay: string | null
}

/**
 * Weekly per-group budget measured against each group's OWN tier target (spec GD5) —
 * Maintain→MEV, Grow (default)→MAV, Emphasize→MRV (musclePriorities.tierTargetOf).
 * Landmark source per group: explicit `volumePerMuscle[group]` (structural {mev,mav,mrv},
 * e.g. a mesocycle's own progressed baselines) → else the static `GROUP_LANDMARKS` → else
 * null (traps/core: no landmark at all, sets-only display, level always 'ok').
 */
export function muscleBudgets(
  days: MesoDay[],
  priorities?: MusclePriorities | null,
  volumePerMuscle?: Record<string, { mev: number; mav: number; mrv: number }> | null,
): MuscleBudgetRow[] {
  const acc = new Map<string, MuscleBudgetRow>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const group = budgetGroup(ex.muscle)
      if (!group) continue
      let row = acc.get(group)
      if (!row) {
        row = {
          group, label: BUDGET_GROUP_LABELS[group] ?? group, colorMuscle: ex.muscle,
          failureSets: 0, volumeSets: 0, workingSets: 0, exemptSets: 0,
          tier: 'grow', target: null, budget: null, level: 'ok', mev: null, zoneStart: null,
          setsToZone: 0, suggestedDay: null,
        }
        acc.set(group, row)
      }
      if (!countsForVolume(ex)) { row.exemptSets += ex.workingSets; continue }
      if (setStyle(ex.targetRIR) === 'failure') row.failureSets += ex.workingSets
      else row.volumeSets += ex.workingSets
      row.workingSets += ex.workingSets
    }
  }
  return [...acc.values()]
    .filter((r) => r.workingSets > 0)
    .map((r) => {
      const lm = volumePerMuscle?.[r.group] ?? GROUP_LANDMARKS[r.group] ?? null
      const tier = tierOf(priorities, r.group)
      const target = lm ? tierTargetOf(tier, lm) : null
      const mev = lm ? lm.mev : null
      const budget = target !== null ? r.workingSets / target : null
      // Maintain's target IS the landmark mev (tierTargetOf) — 'near' is a ramp-approaching-
      // ceiling concept (grow/emphasize: target > mev) that has no meaning when the target is
      // the floor itself, so it's skipped for Maintain. Without this, [0.85·mev, mev) reads as
      // 'near' and mev itself as impossible to reach as 'ok' — holding exactly at MEV must be
      // 'ok', not an amber alarm (spec GD5's own "Farizom · Maintain · 100%" example).
      const level: BudgetLevel =
        target === null ? 'ok'
          : r.workingSets > target ? 'over'
            : tier !== 'maintain' && budget !== null && budget >= NEAR_THRESHOLD ? 'near'
              : mev !== null && r.workingSets < mev ? 'under'
                : 'ok'
      return {
        ...r,
        tier,
        target,
        budget,
        mev,
        zoneStart: target !== null && mev !== null ? Math.min(1, mev / target) : null,
        setsToZone: mev !== null ? Math.max(0, mev - r.workingSets) : 0,
        suggestedDay: level === 'under' ? leastLoadedDayFor(days, r.group, '') : null,
        level,
      }
    })
    .sort((a, b) => (b.budget ?? -1) - (a.budget ?? -1) || a.group.localeCompare(b.group))
}

export interface SessionCapWarning { day: string; group: string; label: string; sets: number }

/** Days where one muscle group exceeds SESSION_MUSCLE_CAP working sets in a single session (exempt work excluded). */
export function sessionCapWarnings(days: MesoDay[]): SessionCapWarning[] {
  const out: SessionCapWarning[] = []
  for (const d of days) {
    const perGroup = new Map<string, number>()
    for (const ex of d.exercises) {
      if (!countsForVolume(ex)) continue
      const group = budgetGroup(ex.muscle)
      if (!group) continue
      perGroup.set(group, (perGroup.get(group) ?? 0) + ex.workingSets)
    }
    for (const [group, sets] of perGroup) {
      if (sets > SESSION_MUSCLE_CAP) out.push({ day: d.day, group, label: BUDGET_GROUP_LABELS[group] ?? group, sets })
    }
  }
  return out
}

export interface DayGroupRow {
  group: string
  label: string
  /** Representative catalog muscle key seen for the group on this day — feed muscleColor(). */
  colorMuscle: string
  sets: number
  exemptSets: number
  over: boolean
}

/** Per-group set totals for a single day, exempt work split out; includes exempt-only groups at sets: 0. */
export function daySessionBreakdown(day: MesoDay): DayGroupRow[] {
  const acc = new Map<string, DayGroupRow>()
  for (const ex of day.exercises) {
    const group = budgetGroup(ex.muscle)
    if (!group) continue
    let row = acc.get(group)
    if (!row) {
      row = { group, label: BUDGET_GROUP_LABELS[group] ?? group, colorMuscle: ex.muscle, sets: 0, exemptSets: 0, over: false }
      acc.set(group, row)
    }
    if (!countsForVolume(ex)) row.exemptSets += ex.workingSets
    else row.sets += ex.workingSets
  }
  return [...acc.values()]
    .map((r) => ({ ...r, over: r.sets > SESSION_MUSCLE_CAP }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group))
}

/**
 * Non-off training day with the fewest non-exempt working sets for `group`, excluding `excludeDay`.
 * Ties broken by fewest total (non-exempt) sets that day, then original day order. Null when no
 * other training day exists.
 */
export function leastLoadedDayFor(days: MesoDay[], group: string, excludeDay: string): string | null {
  const candidates = days
    .map((d, index) => ({ d, index }))
    .filter(({ d }) => d.day !== excludeDay && !isOffDay(d) && d.exercises.length > 0)
  if (candidates.length === 0) return null

  const loadOf = (d: MesoDay) => {
    let groupSets = 0
    let totalSets = 0
    for (const ex of d.exercises) {
      if (!countsForVolume(ex)) continue
      totalSets += ex.workingSets
      if (budgetGroup(ex.muscle) === group) groupSets += ex.workingSets
    }
    return { groupSets, totalSets }
  }

  const best = candidates
    .map(({ d, index }) => ({ day: d.day, index, ...loadOf(d) }))
    .sort((a, b) => a.groupSets - b.groupSets || a.totalSets - b.totalSets || a.index - b.index)[0]
  return best.day
}
