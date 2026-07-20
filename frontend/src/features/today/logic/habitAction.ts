import type { HabitItem } from '@/data/types'

export type HabitAction =
  | { kind: 'check' }
  | { kind: 'nav'; to: string }
  | { kind: 'meal-sheet' }
  | { kind: 'sleep-sheet' }
  | { kind: 'none' }

/** ADR 0010: a CTA never self-completes a DERIVED habit — it opens the underlying log surface. */
const NAV_BY_KEY: Record<string, string> = {
  morning_weigh_in: '/me/weight',
  morning_coffee: '/fuel/stack',
  morning_workout: '/train',
}

/** Sleep-derived habits open the sleep log inline (the chain shouldn't dead-end on a nav away). */
const SLEEP_KEYS = new Set(['wake_on_time', 'bed_on_time'])

export function habitAction(h: HabitItem): HabitAction {
  if (h.status !== 'pending') {
    return { kind: 'none' }
  }
  if (h.mode === 'MANUAL') {
    return { kind: 'check' }
  }
  if (SLEEP_KEYS.has(h.key)) {
    return { kind: 'sleep-sheet' }
  }
  if (h.key === 'protein_breakfast') {
    return { kind: 'meal-sheet' }
  }
  const to = NAV_BY_KEY[h.key]
  return to ? { kind: 'nav', to } : { kind: 'none' }
}
