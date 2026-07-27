import type { RecipeRole } from '@/data/types'

/** HU copy for the recipe's template meal role (mezo-uavr) — the single source of truth for the
 *  editor segments, the detail chip and the library card tag. */
const LABELS: Record<RecipeRole, string> = {
  standard: 'Általános',
  pre_workout: 'Edzés előtt',
  post_workout: 'Edzés után',
}

export const ROLE_OPTIONS: { id: RecipeRole; label: string }[] = [
  { id: 'standard', label: LABELS.standard },
  { id: 'pre_workout', label: LABELS.pre_workout },
  { id: 'post_workout', label: LABELS.post_workout },
]

/** Attributive HU copy for the rubric the template was scored under (mezo-uavr). `LABELS` are
 *  postpositional adverbials („edzés előtt") and cannot attribute a noun — „edzés előtt mérce"
 *  reads as a dropped word — so the score-header note needs its own adjectival map. */
const RUBRIC_LABELS: Record<RecipeRole, string> = {
  standard: 'általános',
  pre_workout: 'edzés előtti',
  post_workout: 'edzés utáni',
}

export function roleLabel(role: RecipeRole): string {
  return LABELS[role] ?? LABELS.standard
}

/** The role as an attribute of the rubric: `{roleRubricLabel(role)} mérce szerint`. */
export function roleRubricLabel(role: RecipeRole): string {
  return RUBRIC_LABELS[role] ?? RUBRIC_LABELS.standard
}
