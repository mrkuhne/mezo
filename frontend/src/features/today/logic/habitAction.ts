import type { HabitItem } from '@/data/types'

export type HabitAction =
  | { kind: 'check' }
  | { kind: 'nav'; to: string }
  | { kind: 'meal-sheet' }
  | { kind: 'none' }

/** ADR 0010: a CTA never self-completes a DERIVED habit — it opens the underlying log surface. */
const NAV_BY_KEY: Record<string, string> = {
  wake_on_time: '/me/sleep',
  bed_on_time: '/me/sleep',
  morning_weigh_in: '/me/weight',
  morning_coffee: '/fuel/stack',
  morning_workout: '/train',
}

export function habitAction(h: HabitItem): HabitAction {
  if (h.status !== 'pending') {
    return { kind: 'none' }
  }
  if (h.mode === 'MANUAL') {
    return { kind: 'check' }
  }
  if (h.key === 'protein_breakfast') {
    return { kind: 'meal-sheet' }
  }
  const to = NAV_BY_KEY[h.key]
  return to ? { kind: 'nav', to } : { kind: 'none' }
}
