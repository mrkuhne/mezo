// ============================================================
// Mezo · trainDayEnergy — the day's movement kcal, as an honest estimate
// (Train Titanium T5 "Mai" face, mezo-88iwa.6). NET-of-rest burn for the day's
// planned training blocks from the shared activity-energy model (mezo-32m82):
// (MET − 1) × restPerHour × hours per block (`data/train/activityEnergy`), split into
// planned vs. already-earned (done). Every planned block counts as the moderate band.
// Zero UI imports — pure module, table-tested.
// ============================================================
import { blockEnergyKind, netKcal } from '@/data/train/activityEnergy'

export type Block = {
  kind: 'gym' | 'sport' | 'run'; minutes: number; done: boolean; sport?: string
  /** The backend-persisted net kcal of the LOGGED session behind a done block — shown verbatim, never re-estimated. */
  loggedKcal?: number | null
}

export type DayEnergy = {
  plannedKcal: number // sum over blocks of the rounded net kcal (activityEnergy.netKcal)
  earnedKcal: number // the done blocks' share of the same sum
  known: boolean // false when rest energy is unknown (null) or there are no blocks
}

export function trainDayEnergy(blocks: Block[], restPerHour: number | null): DayEnergy {
  if (restPerHour == null || blocks.length === 0) return { plannedKcal: 0, earnedKcal: 0, known: false }
  let plannedKcal = 0
  let earnedKcal = 0
  for (const block of blocks) {
    const kcal = block.done && block.loggedKcal != null
      ? block.loggedKcal
      : netKcal(blockEnergyKind(block), null, block.minutes, restPerHour) ?? 0
    plannedKcal += kcal
    if (block.done) earnedKcal += kcal
  }
  return { plannedKcal, earnedKcal, known: true }
}
