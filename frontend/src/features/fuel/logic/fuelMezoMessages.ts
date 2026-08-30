// ============================================================
// Mezo · fuelMezoMessages — which companion messages belong on the Fuel tab
// (Design 2.0 F3.1, mezo-d20.4.1; iterations §2 "a companion voice left the hero").
//
// The hub's Mezo banner shows ONLY a counter and the Mezo · Fuel page collects the
// messages themselves — so both need the same, honest answer to "is this message
// about fuel?". The answer is read off the message's own REFERENCES (`BriefingRef.kind`,
// the same field RefTag renders), never off prose keyword-scraping: a ref kind is a
// structured claim the generator made about what the message is anchored to, a
// substring match in the body is a guess.
//
// Consequence, deliberately: a day whose companion messages carry no fuel ref shows
// the counter-less banner and an empty page — the honest state, not a padded thread.
//
// Pure: no React, no hooks. Feeds FuelMaiPage (counter) + FuelMezoPage (thread).
// ============================================================
import type { MezoMessageItem } from '@/features/today/logic/mezoMessages'

/** Ref kinds that anchor a message to the Fuel domain. Compared case-insensitively —
 *  the wire's kinds are free-form display strings ('Meal', 'meal', 'Recept'…). */
const FUEL_REF_KINDS = new Set([
  'meal', 'meals', 'étkezés', 'etkezes',
  'fuel', 'nutrition', 'macro', 'macros', 'makró', 'makro',
  'recipe', 'recept',
  'pantry', 'kamra',
  'stack', 'supplement', 'supplements', 'kiegészítő', 'kiegeszito',
  'water', 'víz', 'viz',
  'medication', 'gyógyszer', 'gyogyszer',
])

export function isFuelMessage(m: MezoMessageItem): boolean {
  return m.refs.some((r) => FUEL_REF_KINDS.has(r.kind.trim().toLowerCase()))
}

/** The day's Fuel-context companion messages, in the thread's own order. */
export function fuelMezoMessages(messages: MezoMessageItem[]): MezoMessageItem[] {
  return messages.filter(isFuelMessage)
}
