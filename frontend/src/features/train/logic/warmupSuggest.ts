// ============================================================
// Mezo · warmupSuggest — adaptive warmup-set-count suggestion for the meso
// day editor (mezo-dnln, budget wave-2 spec 2026-08-03-budget-wave2). Pure
// client-side heuristic, no server call: mirrors the backend's count-keyed
// warmup ladders in spirit (more ramp-up for a first heavy compound of a
// muscle group, none for bodyweight/plyo work) so a newly added exercise
// lands on a sane warmup count without the athlete thinking about it — the
// ExerciseAccordionRow "↺ javaslat" chip always lets them override it.
// ============================================================
import type { MesoDay } from '@/data/types'
import { budgetGroup } from '@/features/train/logic/setBudget'

/**
 * Suggests a `warmupSets` count for `exId` within `day`, from its exercise
 * type/muscle-group and its position among the day's earlier non-plyo
 * exercises of the same budget group:
 * - `type === 'plyo'`, or **bodyweight-ish** (`anchorWeightKg == null &&
 *   repMax >= 15`) → 0
 * - unknown budget group (`budgetGroup` null, e.g. a sport row) → 0
 * - the first non-plyo `compound` opening its group → 3, but 2 when
 *   `anchorWeightKg != null && anchorWeightKg < 60` (a lighter compound
 *   needs less ramp-up)
 * - a later `compound` of an already-hit group → 1
 * - an `isolation` exercise opening its group → 1
 * - an `isolation` exercise after the group was hit → 0
 *
 * "Group hit" only counts **non-plyo** exercises earlier in the day's
 * order — a plyo row of the same group never makes a later compound/
 * isolation "not first".
 */
export function suggestedWarmupSets(day: MesoDay, exId: string): number {
  const index = day.exercises.findIndex((e) => e.id === exId)
  if (index === -1) return 0
  const ex = day.exercises[index]

  if (ex.type === 'plyo') return 0
  if (ex.anchorWeightKg == null && ex.repMax >= 15) return 0

  const group = budgetGroup(ex.muscle)
  if (!group) return 0

  const groupHit = day.exercises
    .slice(0, index)
    .some((e) => e.type !== 'plyo' && budgetGroup(e.muscle) === group)

  if (ex.type === 'compound') {
    if (groupHit) return 1
    return ex.anchorWeightKg != null && ex.anchorWeightKg < 60 ? 2 : 3
  }
  // isolation
  return groupHit ? 0 : 1
}
