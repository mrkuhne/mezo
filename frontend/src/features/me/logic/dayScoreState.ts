// ============================================================
// Heti · a nap négy becsületes állapota (mezo-d20.6.10)
// Handoff §4: today's UI conflates "kevés adat a pontszámhoz" with "ezen a
// napon nem logoltál" — both render as a bare null score. They are DIFFERENT
// facts about the user's week and the design shows them differently, so the
// distinction lives here, in one pure place, and every Heti surface reads it.
//   scored   — the Mezo scored the day
//   learning — logged, but fewer than two measured areas ⇒ no score is given
//   nodata   — nothing at all was logged ⇒ the day does not count in the week
//   future   — still ahead of today
// ============================================================
import type { MeWeekDay } from '@/data/me/meWeek'

export type DayScoreState = 'scored' | 'learning' | 'nodata' | 'future'

/** True when the day carries no log of any kind — no sub-score, no fuel, no sleep,
 *  no weight, no check-in, no workout, no XP. A `0` count is "nothing logged", not
 *  a datum; a `0` XP day that HAS logs is still a logged day (the counts catch it). */
export function isDayUnlogged(day: MeWeekDay): boolean {
  const s = day.subscores
  const anySubscore = s.sleep != null || s.fuel != null || s.checkin != null || s.activity != null
  return !anySubscore
    && day.kcal == null && day.proteinG == null
    && day.sleepMin == null && day.weightKg == null
    && !day.checkinCount && !day.workoutCount && !day.xp
}

/** How many of the four sub-scores the Mezo could actually measure. Two is the
 *  threshold below which it refuses to score the day at all (handoff §4). */
export function measuredSubscores(day: MeWeekDay): number {
  const s = day.subscores
  return [s?.sleep, s?.fuel, s?.checkin, s?.activity].filter((v) => v != null).length
}

/** The positive reading of `isDayUnlogged` — true when the day carries ANY logged
 *  signal at all. This is the `nincs adat` / `tanulom` split, and the reason they are
 *  two states rather than one: "you logged nothing" and "you logged too little to
 *  score" are different sentences to a user, and only one of them is their doing. */
export function dayHasAnyLog(day: MeWeekDay): boolean {
  return !isDayUnlogged(day)
}

/** `todayIso` is the viewer's LOCAL today (`localDateString()`), not a UTC slice. */
export function dayScoreState(day: MeWeekDay, todayIso: string): DayScoreState {
  if (day.date > todayIso) return 'future'
  if (day.score != null) return 'scored'
  return isDayUnlogged(day) ? 'nodata' : 'learning'
}

/** The short state word that stands where a score would be. Never `0`, never `—`
 *  passed off as a value: `—` is the missing-datum glyph, these are STATES. */
export const DAY_STATE_LABEL: Record<DayScoreState, string> = {
  scored: '',
  learning: 'tanulom',
  nodata: 'nincs adat',
  future: 'még előtted',
}

/** The full sentence each state owes the user (handoff §4, verbatim). */
export const DAY_STATE_COPY: Record<DayScoreState, string> = {
  scored: '',
  learning: 'Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.',
  nodata: 'ezen a napon nem logoltál — a hét pontszámába nem számít bele',
  future: 'még előtted — ide majd a nap adatai jönnek',
}
