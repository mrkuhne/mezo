// Weekly review (mezo-p2tr) — pure ±7-day stepping over ISO Monday week-starts, plus the
// "is this the current week" guard the stepper's next-week chip disables on. Kept separate
// from WeekPage so the ±7-day / boundary math is unit-testable without rendering the page.
import { addDays } from '@/shared/lib/dates'
import { mondayIso } from '@/data/fuel/fuelWeekHooks'

/** The Monday one week before `startIso`. */
export function prevMonday(startIso: string): string {
  return addDays(startIso, -7)
}

/** The Monday one week after `startIso`. */
export function nextMonday(startIso: string): string {
  return addDays(startIso, 7)
}

/** True only for the Monday of the week containing today (the next-week chip's disable guard). */
export function isCurrentWeek(startIso: string): boolean {
  return startIso === mondayIso()
}

/** `?start=` -> a real ISO Monday, or the current week's when absent/invalid/not-a-Monday.
 *  Shared by every Heti surface (mezo-d20.6.10) so the hub and its detail pages can never
 *  disagree about which week a link points at. */
export function resolveWeekStart(raw: string | null | undefined): string {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d && dt.getDay() === 1) return raw
  }
  return mondayIso()
}

/** The Heti hub's URL for a browsed week — the `‹ Heti` back target of every detail page.
 *  The current week is the hub's own default, so it travels without a redundant query. */
export function weekHubPath(startIso: string): string {
  return isCurrentWeek(startIso) ? '/me/week' : `/me/week?start=${startIso}`
}
