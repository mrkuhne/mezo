import type { DailyQuest } from '@/data/types'

/**
 * The one smart log-CTA of an OFFERED quest row on Today (mezo-gj2y). ADR 0010 forbids
 * self-claimed completion, so the CTA never "completes" a quest — it opens/performs the
 * underlying log (derived evaluation flips the quest on the next day read).
 */
export type QuestAction =
  | { kind: 'water'; label: string; amountMl: number }
  | { kind: 'checkin'; label: string }
  | { kind: 'activity'; label: string }
  | { kind: 'nav'; label: string; to: string }

/** Maps a quest to its smart CTA; null → state-only row (unknown/future metric). */
export function questAction(q: DailyQuest): QuestAction | null {
  if (q.completionMode === 'ACTIVITY') return { kind: 'activity', label: 'Naplózz' }
  switch (q.metric) {
    case 'water_target': return { kind: 'water', label: '+250 ml', amountMl: 250 }
    case 'checkin_full': return { kind: 'checkin', label: 'Check-in' }
    case 'weight_logged': return { kind: 'nav', label: 'Mérés', to: '/me/weight' }
    case 'sleep_target': return { kind: 'nav', label: 'Alvás', to: '/me/sleep' }
    case 'protein_target': return { kind: 'nav', label: 'Fuel', to: '/fuel' }
    case 'own_recipe_meal': return { kind: 'nav', label: 'Főzés', to: '/fuel/recipes' }
    case 'gym_session_done': return { kind: 'nav', label: 'Edzés', to: '/train' }
    default: return null
  }
}
