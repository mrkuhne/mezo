// ============================================================
// Mezo · muscleWeek — per-muscle weekly aggregation of the active meso's
// template week (mezo-ly27 muscle-week sheet). Working sets only (warmups
// excluded, the GymPage `Szetek` convention); off-day rows excluded by
// muscle key ('' / 'sport'), the builder's off-day rule.
// ============================================================
import type { MesoDay } from '@/data/types'
import { muscleRegion, REGION_LABELS, REGION_ORDER, type RegionKey } from '@/features/train/logic/muscleColors'

export interface MuscleWeekRow {
  muscle: string
  workingSets: number
  /** Weekly total reps at the recipe's low/high end (Σ sets×repMin / Σ sets×repMax). */
  repMinTotal: number
  repMaxTotal: number
  exerciseCount: number
  /** Days of the template week with ≥1 exercise for this muscle. */
  gymFrequency: number
}

export function muscleWeekFromMeso(days: MesoDay[]): MuscleWeekRow[] {
  const acc = new Map<string, MuscleWeekRow & { daysSeen: Set<string> }>()
  for (const d of days) {
    for (const ex of d.exercises) {
      const m = ex.muscle
      if (!m || m === 'sport') continue
      let row = acc.get(m)
      if (!row) {
        row = { muscle: m, workingSets: 0, repMinTotal: 0, repMaxTotal: 0, exerciseCount: 0, gymFrequency: 0, daysSeen: new Set() }
        acc.set(m, row)
      }
      row.workingSets += ex.workingSets
      row.repMinTotal += ex.workingSets * ex.repMin
      row.repMaxTotal += ex.workingSets * ex.repMax
      row.exerciseCount += 1
      row.daysSeen.add(d.day)
    }
  }
  return [...acc.values()]
    .map(({ daysSeen, ...row }) => ({ ...row, gymFrequency: daysSeen.size }))
    .sort((a, b) => b.workingSets - a.workingSets || a.muscle.localeCompare(b.muscle))
}

export interface MuscleRegionGroup { region: RegionKey; label: string; rows: MuscleWeekRow[] }

/** Card-grid grouping: fixed region order, empty regions omitted. */
export function muscleRegionGroups(rows: MuscleWeekRow[]): MuscleRegionGroup[] {
  return REGION_ORDER
    .map((region) => ({ region, label: REGION_LABELS[region], rows: rows.filter((r) => muscleRegion(r.muscle) === region) }))
    .filter((g) => g.rows.length > 0)
}
