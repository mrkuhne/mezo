// Meal role as the SERVER scored it (mezo-zeeq). The backend classifies pre/post/standard at
// write time (MealScoringService.classifyRole) but neither persists nor sends the enum — the
// only wire trace is the context dimension's `Szerep` row, emitted for non-standard roles.
// Reading it back (rather than re-deriving on the FE from plan.workout) keeps the card chip
// and the sheet's own context dimension telling the same story. Unscored → null (no chip).
import type { FuelMeal } from '@/data/types'

export type MealContext = 'standard' | 'pre' | 'post'
export const MEAL_CONTEXT_LABEL: Record<MealContext, string> = { standard: 'Standard', pre: 'Pre-workout', post: 'Post-workout' }

export function mealContextOf(meal: Pick<FuelMeal, 'breakdown'>): MealContext | null {
  const b = meal.breakdown
  if (!b) return null
  // A sparse breakdown (older seeds / tests) may carry no dimensions at all — still "scored".
  const dim = b.dimensions?.find(d => d.id === 'context')
  const row = dim && 'context' in dim ? dim.context.find(r => r.label === 'Szerep') : undefined
  const v = row?.value ?? ''
  if (v.startsWith('Pre-workout')) return 'pre'
  if (v.startsWith('Post-workout')) return 'post'
  return 'standard'
}
