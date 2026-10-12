// matchMealsToStack — deterministic meal-match logic for the Fuel/Stack day (mezo-vx9v). For each
// zoned stack slot, decides whether its supplements need a fatty (breakfast/lunch/dinner) or a
// protein-rich (post_workout) meal alongside them, then either suggests the best-fitting recipe
// (ranked by macro-per-serving, tie-broken by mezoFit.score desc) or verifies today's/yesterday's
// logged meal in that zone against the macro floor (FAT_OK_G). Pure, no React, no ambient time —
// the caller passes today's/yesterday's meals explicitly. Kept simple per design: verdicts only
// for meal zones (breakfast/lunch/dinner); post_workout gets suggestions only.

import { mealSlotKey, perServing } from '@/features/fuel/logic/buildDayPlan'
import type { StackDayEntry, StackDaySlot } from '@/features/fuel/logic/projectStackDay'
import type { FuelMeal, Recipe, StackZoneKey } from '@/data/types'
import { m } from '@/shared/i18n'

export const FAT_BOUND_NEEDLES = ['d3', 'k2', 'omega', 'halolaj', 'krill', 'kurkum', 'q10', 'koenzim']
const PROTEIN_BOUND_NEEDLES = ['whey', 'protein', 'fehérje']
export const FAT_OK_G = 15
export const PROTEIN_OK_G = 25

const MEAL_ZONES: StackZoneKey[] = ['breakfast', 'lunch', 'dinner']

export interface MealMatchSuggestion {
  zone: StackZoneKey
  zoneLabel: string
  time: string
  recipeId: string
  recipeName: string
  metric: string // '32 g zsír / adag'
  reason: string
}
export interface MealMatchVerdict {
  zone: StackZoneKey
  /** which day the meal is from — the key; `dayLabel` is its word in the current language */
  day: 'today' | 'yesterday'
  dayLabel: string
  mealTitle: string
  ok: boolean
  metric: string // '28 g zsír' / '6 g zsír'
  advice: string | null // set when !ok
}
export interface MealMatchResult {
  suggestions: MealMatchSuggestion[]
  verdicts: MealMatchVerdict[]
}

/** First non-skipped entry of the zone whose name matches one of `needles` (case-insensitive). */
function firstBoundEntry(entries: StackDayEntry[], needles: string[]): StackDayEntry | undefined {
  return entries.find(e => !e.skippedToday && needles.some(n => e.name.toLowerCase().includes(n)))
}

/** Best candidate recipe for the zone: ranked by macro-per-serving desc, tie-broken by
 *  `mezoFit.score ?? 0` desc. No candidate → null. */
function bestRecipe(candidates: Recipe[], macro: 'f' | 'p'): Recipe | null {
  if (candidates.length === 0) return null
  return [...candidates].sort((a, z) => {
    const da = perServing(a)[macro]
    const dz = perServing(z)[macro]
    if (da !== dz) return dz - da
    return (z.mezoFit.score ?? 0) - (a.mezoFit.score ?? 0)
  })[0]
}

function suggestionFor(
  slot: StackDaySlot,
  candidates: Recipe[],
  macro: 'f' | 'p',
  entryName: string,
): MealMatchSuggestion | null {
  const rec = bestRecipe(candidates, macro)
  if (!rec) return null
  const val = Math.round(perServing(rec)[macro])
  const M = m().fuelKieg.match
  return {
    zone: slot.zone,
    zoneLabel: slot.label,
    time: slot.time,
    recipeId: rec.id,
    recipeName: rec.name,
    metric: macro === 'f' ? M.fatPerServing(val) : M.proteinPerServing(val),
    reason: macro === 'f' ? M.wantsFat(entryName) : M.wantsProtein(entryName),
  }
}

/** Verdicts for the meals of one day (today/yesterday) that fall into this fat-bound zone. */
function verdictsFor(slot: StackDaySlot, meals: FuelMeal[], day: 'today' | 'yesterday', entryName: string): MealMatchVerdict[] {
  const out: MealMatchVerdict[] = []
  const M = m().fuelKieg.match
  for (const meal of meals) {
    if (mealSlotKey(meal) !== slot.zone) continue
    const ok = meal.f >= FAT_OK_G
    out.push({
      zone: slot.zone,
      day,
      dayLabel: M[day],
      mealTitle: meal.title,
      ok,
      metric: M.fat(Math.round(meal.f)),
      advice: ok ? null : M.advice(entryName),
    })
  }
  return out
}

/** Recipe suggestions for supplement zones (max 1/zone) + today's/yesterday's meal-vs-stack
 *  verdicts, both driven off which zones actually carry a fat- or protein-bound entry today. */
export function matchMealsToStack(
  slots: StackDaySlot[],
  recipes: Recipe[],
  todayMeals: FuelMeal[],
  yesterdayMeals: FuelMeal[],
): MealMatchResult {
  const suggestions: MealMatchSuggestion[] = []
  const verdicts: MealMatchVerdict[] = []

  for (const slot of slots) {
    if (slot.zone === 'post_workout') {
      const bound = firstBoundEntry(slot.entries, PROTEIN_BOUND_NEEDLES)
      if (!bound) continue
      // Suggestions stay within the zone's meal role — deliberate narrowing vs "highest protein overall".
      const candidates = recipes.filter(r => r.role === 'post_workout')
      const suggestion = suggestionFor(slot, candidates, 'p', bound.name)
      if (suggestion) suggestions.push(suggestion)
      continue
    }
    if (!MEAL_ZONES.includes(slot.zone)) continue
    const bound = firstBoundEntry(slot.entries, FAT_BOUND_NEEDLES)
    if (!bound) continue

    // Suggestions stay within the zone's meal category — deliberate narrowing vs "fattiest overall".
    const candidates = recipes.filter(r => r.category === slot.zone)
    const suggestion = suggestionFor(slot, candidates, 'f', bound.name)
    if (suggestion) suggestions.push(suggestion)

    verdicts.push(...verdictsFor(slot, todayMeals, 'today', bound.name))
    verdicts.push(...verdictsFor(slot, yesterdayMeals, 'yesterday', bound.name))
  }

  return { suggestions, verdicts }
}
