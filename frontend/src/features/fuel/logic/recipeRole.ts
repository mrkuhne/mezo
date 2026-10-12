import type { RecipeRole } from '@/data/types'
import { m } from '@/shared/i18n'

/** Copy for the recipe's template meal role (mezo-uavr) — the single source of truth for the
 *  editor segments, the detail chip and the library card tag. The words live in the catalog
 *  (`fuelLogika.recipeRole.role`) and are read when CALLED, so they follow a language switch. */
export function roleLabel(role: RecipeRole): string {
  const labels = m().fuelLogika.recipeRole.role
  return labels[role] ?? labels.standard
}

/** `label` is a getter: `ROLE_OPTIONS.map(o => o.label)` reads the catalog at render time. */
const option = (id: RecipeRole): { id: RecipeRole; label: string } => ({ id, get label() { return roleLabel(id) } })

export const ROLE_OPTIONS: { id: RecipeRole; label: string }[] = [
  option('standard'),
  option('pre_workout'),
  option('post_workout'),
]

/** The role as an attribute of the rubric: `{roleRubricLabel(role)} mérce szerint` (mezo-uavr). The
 *  role labels are postpositional adverbials in Hungarian („edzés előtt") and cannot attribute a
 *  noun — „edzés előtt mérce" reads as a dropped word — so the score-header note has its own
 *  adjectival words (`fuelLogika.recipeRole.rubric`). */
export function roleRubricLabel(role: RecipeRole): string {
  const labels = m().fuelLogika.recipeRole.rubric
  return labels[role] ?? labels.standard
}
