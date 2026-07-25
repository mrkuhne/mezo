/** Pure evening-window math. HH:mm strings wrap at midnight (R2 final-review binding
 *  constraint): never compare lexically — everything is minutes relative to opensAt. */
import type { RitualWindow } from '@/data/types'

const toMins = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Minutes from `now` forward to the next occurrence of `hhmm` (0..1439). */
export function minutesUntil(now: Date, hhmm: string): number {
  const nowM = now.getHours() * 60 + now.getMinutes()
  return (toMins(hhmm) - nowM + 1440) % 1440
}

/** The window opens at opensAt and stays open for the rest of the evening (soft window —
 *  ADR 0010: the CTA nudges, never locks). "Open" = we are within 12h AFTER opensAt,
 *  measured forward from opensAt with wrap; otherwise the evening hasn't arrived yet. */
export function ritualWindowState(now: Date, w: RitualWindow): 'waiting' | 'open' {
  const nowM = now.getHours() * 60 + now.getMinutes()
  const sinceOpen = (nowM - toMins(w.opensAt) + 1440) % 1440
  return sinceOpen < 12 * 60 ? 'open' : 'waiting'
}
