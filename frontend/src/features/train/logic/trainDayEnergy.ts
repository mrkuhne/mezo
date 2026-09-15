// ============================================================
// Mezo · trainDayEnergy — the day's movement kcal, as an honest estimate
// (Train Titanium T5 "Mai" face, mezo-88iwa.6). MET-based burn for the day's
// planned training blocks, split into planned vs. already-earned (done).
// Zero UI imports — pure module, table-tested.
// ============================================================
import { MET_BY_KIND } from '@/data/fuel/fuelConfig'

export type Block = { kind: 'gym' | 'sport' | 'run'; minutes: number; done: boolean }

export type DayEnergy = {
  plannedKcal: number // rounded sum over blocks: MET_BY_KIND[kind] × weightKg × minutes/60
  earnedKcal: number // the done blocks' share of the same sum
  known: boolean // false when weightKg is null/0 or there are no blocks
}

export function trainDayEnergy(blocks: Block[], weightKg: number | null): DayEnergy {
  if (!weightKg || blocks.length === 0) {
    return { plannedKcal: 0, earnedKcal: 0, known: false }
  }

  let plannedKcal = 0
  let earnedKcal = 0
  for (const block of blocks) {
    const kcal = MET_BY_KIND[block.kind] * weightKg * (block.minutes / 60)
    plannedKcal += kcal
    if (block.done) earnedKcal += kcal
  }

  return { plannedKcal: Math.round(plannedKcal), earnedKcal: Math.round(earnedKcal), known: true }
}
