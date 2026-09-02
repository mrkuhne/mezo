// ============================================================
// Mezo · weeklyBands — wizard v2's weekly per-muscle set band: planned sets
// this week vs. the tier's start (week-1) and ceiling landmark, no percent
// text (mesocycle wizard redesign, mezo-d20.14). Replaces SetBudgetCard's
// muscleBudgets-driven % pills in the day editor and the muscle-week sheet.
// ============================================================
import type { MesoDay, MusclePriorities, MuscleTier } from '@/data/types'
import { BUDGET_GROUP_LABELS, GROUP_LANDMARKS, budgetGroup, countsForVolume } from '@/features/train/logic/setBudget'
import { tierOf } from '@/features/train/logic/musclePriorities'
import { ceilingSets, weekOneSets, type Landmark } from '@/features/train/logic/mesoPlan'

export interface BandRow {
  group: string
  label: string
  tier: MuscleTier
  /** Sets planned in the days this week. */
  planned: number
  start: number
  ceiling: number
  /** planned / ceiling, 0..100+. Never rendered as text. */
  pct: number
  step: '+2' | 'hold'
}

/**
 * One row per coarse muscle group carrying planned sets (or an explicit landmark) this week,
 * sorted by ceiling desc so Emphasize tiers read first. Groups with neither planned sets nor
 * a landmark are omitted. Only countsForVolume(ex) working sets, grouped via budgetGroup(ex.muscle).
 */
export function weeklyBands(days: MesoDay[], priorities: MusclePriorities | null, landmarks?: Record<string, Landmark>): BandRow[] {
  const planned = new Map<string, number>()
  for (const d of days) {
    for (const ex of d.exercises ?? []) {
      if (!countsForVolume(ex)) continue
      const g = budgetGroup(ex.muscle)
      if (!g) continue
      planned.set(g, (planned.get(g) ?? 0) + ex.workingSets)
    }
  }

  const rows: BandRow[] = []
  for (const [group, sets] of planned) {
    const lm = landmarks?.[group] ?? GROUP_LANDMARKS[group]
    if (!lm) continue
    const tier = tierOf(priorities, group)
    const start = weekOneSets(tier, lm)
    const ceiling = ceilingSets(tier, lm)
    rows.push({
      group,
      label: BUDGET_GROUP_LABELS[group] ?? group,
      tier,
      planned: sets,
      start,
      ceiling,
      pct: Math.round((sets / ceiling) * 100),
      step: tier === 'maintain' || sets >= ceiling ? 'hold' : '+2',
    })
  }

  return rows.sort((a, b) => b.ceiling - a.ceiling || a.label.localeCompare(b.label))
}
