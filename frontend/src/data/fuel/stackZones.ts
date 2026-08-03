import type { StackZoneKey } from '@/data/types'

/** Canonical zone order + HU labels (mezo-vx9v). Keys are the wire contract — never rename. */
export const STACK_ZONE_ORDER: StackZoneKey[] = [
  'wake', 'breakfast', 'pre_workout', 'post_workout', 'lunch', 'dinner', 'evening', 'bedtime',
]
export const STACK_ZONE_LABEL: Record<StackZoneKey, string> = {
  wake: 'Ébredés', breakfast: 'Reggeli', pre_workout: 'Edzés előtt', post_workout: 'Edzés után',
  lunch: 'Ebéd', dinner: 'Vacsora', evening: 'Este', bedtime: 'Lefekvés',
}
