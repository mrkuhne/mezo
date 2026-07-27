import type { FuelMeal } from '@/data/types'
import { deriveMealName } from '@/features/fuel/logic/deriveMealName'

/** Display name for a logged meal (mezo-u68c): its title, else derived from its item names,
 *  else undefined (callers supply a final fallback). Shared by the timeline (buildDayPlan) and
 *  the score sheet so one de-blank rule holds everywhere. */
export function mealDisplayName(m: FuelMeal): string | undefined {
  return m.title || deriveMealName(m.mealItems.map(l => l.name)) || undefined
}
