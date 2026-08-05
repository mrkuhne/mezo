// Meal-slot templates (mezo-7102) — maps the day's real training blocks onto one of three
// canonical day types (`rest` | `training_am` | `training_pm`) that `compileTemplate` replays a
// `SlotTemplate` against. Pure, deterministic: no ambient time — the block list is the only input.

import { toMin } from '@/data/fuel/fuelConfig'
import type { PlannerBlock } from '@/features/fuel/logic/buildDayPlan'
import type { SlotTemplateDayType } from '@/data/types'

/** No blocks → 'rest'. Otherwise the day type follows the EARLIEST block start: before noon
 *  (`toMin(block.time) < 720`) → 'training_am', at/after noon → 'training_pm'. */
export function resolveDayType(blocks: PlannerBlock[]): SlotTemplateDayType {
  if (blocks.length === 0) return 'rest'
  const earliest = Math.min(...blocks.map(b => toMin(b.time)))
  return earliest < 720 ? 'training_am' : 'training_pm'
}
