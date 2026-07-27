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

export function roleLabel(role: RecipeRole): string {
  return LABELS[role] ?? LABELS.standard
}
