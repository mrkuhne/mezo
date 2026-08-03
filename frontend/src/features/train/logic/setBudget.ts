// ============================================================
// Mezo · setBudget — planning-time weekly set-budget per muscle group
// (mezo-7rdg, spec 2026-08-01). Source: Built With Science video
// (yt ehQ_5TThkRI, Zourdos/Remmert): failure style (RIR≤1) is productive
// up to ~12 sets/muscle/week, volume style (RIR≥2) up to ~20; beyond ~11
// sets/muscle in ONE session extra sets don't add growth. Budget model:
// each failure set costs 1/12, each volume set 1/20 of the weekly budget.
// Pure client-side derivation from the meso days template — nothing persisted.
// Granularity is the coarse muscle group (chest/back/…): finer than the 6
// color regions (Kar/Láb would over-merge), coarser than the 21 heads.
// ============================================================
import type { MesoDay } from '@/data/types'
import { isOffDay } from '@/features/train/logic/offDay'

export type SetStyle = 'failure' | 'volume'
export const FAILURE_WEEKLY_CAP = 12
export const VOLUME_WEEKLY_CAP = 20
export const SESSION_MUSCLE_CAP = 11
export const NEAR_THRESHOLD = 0.85

// Weekly minimum-effective set counts per budget group — lower edges of the
// RP intermediate MEV ranges (docs/research/concepts/program-design-rules.md),
// conservative on purpose. traps/core are intentionally absent: RP treats
// their MEV as ~0 (indirect volume from rows/deadlifts/compounds covers them),
// so they never trigger the under-volume signal. "Starting points, not gospel."
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

export function budgetLevel(budget: number): BudgetLevel {
  return budget > 1 ? 'over' : budget >= NEAR_THRESHOLD ? 'near' : 'ok'
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
  /** Plyo sets don't count toward the budget — reported separately for visibility. */
  plyoSets: number
  /** 1 = 100% of the weekly budget. */
  budget: number
  level: BudgetLevel
  /** Weekly minimum-effective sets for the group; null = no lower bound (traps/core). */
  mev: number | null
  /** Green-zone start on the budget scale (same 0..1 unit as budget); null when mev is. */
  zoneStart: number | null
  /** Non-plyo sets still missing to reach MEV; 0 when in zone or no lower bound. */
  setsToZone: number
  /** Least-loaded training day to add the missing sets on; only set for under rows. */
  suggestedDay: string | null
}

export function muscleBudgets(days: MesoDay[]): MuscleBudgetRow[] {
  const acc = new Map<string, MuscleBudgetRow>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const group = budgetGroup(ex.muscle)
      if (!group) continue
      let row = acc.get(group)
      if (!row) {
        row = { group, label: BUDGET_GROUP_LABELS[group] ?? group, colorMuscle: ex.muscle, failureSets: 0, volumeSets: 0, workingSets: 0, plyoSets: 0, budget: 0, level: 'ok', mev: null, zoneStart: null, setsToZone: 0, suggestedDay: null }
        acc.set(group, row)
      }
      if (ex.type === 'plyo') { row.plyoSets += ex.workingSets; continue }
      if (setStyle(ex.targetRIR) === 'failure') row.failureSets += ex.workingSets
      else row.volumeSets += ex.workingSets
      row.workingSets += ex.workingSets
    }
  }
  return [...acc.values()]
    .filter((r) => r.workingSets > 0)
    .map((r) => {
      const budget = budgetOf(r.failureSets, r.volumeSets)
      const mev = GROUP_MEV[r.group] ?? null
      const under = mev !== null && r.workingSets < mev
      // Project the MEV set count onto the budget scale with the group's own
      // style mix: at exactly MEV sets the bar would sit at budget × MEV / sets.
      return {
        ...r,
        budget,
        mev,
        zoneStart: mev !== null ? Math.min(1, (budget * mev) / r.workingSets) : null,
        setsToZone: mev !== null ? Math.max(0, mev - r.workingSets) : 0,
        suggestedDay: under ? leastLoadedDayFor(days, r.group, '') : null,
        level: under ? ('under' as const) : budgetLevel(budget),
      }
    })
    .sort((a, b) => b.budget - a.budget || a.group.localeCompare(b.group))
}

export interface SessionCapWarning { day: string; group: string; label: string; sets: number }

/** Days where one muscle group exceeds SESSION_MUSCLE_CAP working sets in a single session (plyo excluded). */
export function sessionCapWarnings(days: MesoDay[]): SessionCapWarning[] {
  const out: SessionCapWarning[] = []
  for (const d of days) {
    const perGroup = new Map<string, number>()
    for (const ex of d.exercises) {
      if (ex.type === 'plyo') continue
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
  plyoSets: number
  over: boolean
}

/** Per-group set totals for a single day, plyo split out; includes plyo-only groups at sets: 0. */
export function daySessionBreakdown(day: MesoDay): DayGroupRow[] {
  const acc = new Map<string, DayGroupRow>()
  for (const ex of day.exercises) {
    const group = budgetGroup(ex.muscle)
    if (!group) continue
    let row = acc.get(group)
    if (!row) {
      row = { group, label: BUDGET_GROUP_LABELS[group] ?? group, colorMuscle: ex.muscle, sets: 0, plyoSets: 0, over: false }
      acc.set(group, row)
    }
    if (ex.type === 'plyo') row.plyoSets += ex.workingSets
    else row.sets += ex.workingSets
  }
  return [...acc.values()]
    .map((r) => ({ ...r, over: r.sets > SESSION_MUSCLE_CAP }))
    .sort((a, b) => b.sets - a.sets || a.group.localeCompare(b.group))
}

/**
 * Non-off training day with the fewest non-plyo working sets for `group`, excluding `excludeDay`.
 * Ties broken by fewest total (non-plyo) sets that day, then original day order. Null when no
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
      if (ex.type === 'plyo') continue
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
