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

export type SetStyle = 'failure' | 'volume'
export const FAILURE_WEEKLY_CAP = 12
export const VOLUME_WEEKLY_CAP = 20
export const SESSION_MUSCLE_CAP = 11
export const NEAR_THRESHOLD = 0.85

export function setStyle(targetRIR: number): SetStyle {
  return targetRIR <= 1 ? 'failure' : 'volume'
}

export type BudgetLevel = 'ok' | 'near' | 'over'

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
  /** 1 = 100% of the weekly budget. */
  budget: number
  level: BudgetLevel
}

export function muscleBudgets(days: MesoDay[]): MuscleBudgetRow[] {
  const acc = new Map<string, MuscleBudgetRow>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const group = budgetGroup(ex.muscle)
      if (!group) continue
      let row = acc.get(group)
      if (!row) {
        row = { group, label: BUDGET_GROUP_LABELS[group] ?? group, colorMuscle: ex.muscle, failureSets: 0, volumeSets: 0, workingSets: 0, budget: 0, level: 'ok' }
        acc.set(group, row)
      }
      if (setStyle(ex.targetRIR) === 'failure') row.failureSets += ex.workingSets
      else row.volumeSets += ex.workingSets
      row.workingSets += ex.workingSets
    }
  }
  return [...acc.values()]
    .map((r) => { const budget = budgetOf(r.failureSets, r.volumeSets); return { ...r, budget, level: budgetLevel(budget) } })
    .sort((a, b) => b.budget - a.budget || a.group.localeCompare(b.group))
}

export interface SessionCapWarning { day: string; group: string; label: string; sets: number }

/** Days where one muscle group exceeds SESSION_MUSCLE_CAP working sets in a single session. */
export function sessionCapWarnings(days: MesoDay[]): SessionCapWarning[] {
  const out: SessionCapWarning[] = []
  for (const d of days) {
    const perGroup = new Map<string, number>()
    for (const ex of d.exercises) {
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
