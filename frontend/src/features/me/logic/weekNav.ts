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
