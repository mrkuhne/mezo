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
import { INTRINSIC_SUBSCORE_KEYS } from '@/features/me/logic/weekDay'

export type DayScoreState = 'scored' | 'learning' | 'nodata' | 'future'

/** True when the day carries no log of any kind — no sub-score, no fuel, no sleep,
 *  no weight, no check-in, no workout, no XP. A `0` count is "nothing logged", not
 *  a datum; a `0` XP day that HAS logs is still a logged day (the counts catch it). */
export function isDayUnlogged(day: MeWeekDay): boolean {
  const s = day.subscores
  // A ritmus szándékosan kimarad — lásd INTRINSIC_SUBSCORE_KEYS: extrinsic jel, egy érintetlen
  // napon is kaphat értéket a szomszédos napokból, és „logolt nappá" hazudná ezt a napot.
  const anySubscore = INTRINSIC_SUBSCORE_KEYS.some((k) => s?.[k] != null)
  return !anySubscore
    && day.kcal == null && day.proteinG == null
    && day.sleepMin == null && day.weightKg == null
    && !day.checkinCount && !day.workoutCount && !day.xp
}

/** Hány INTRINSIC dimenziót tudott ténylegesen mérni a Mezo ezen a napon. Kettő az a küszöb,
 *  ami alatt egyáltalán nem ad pontszámot (handoff §4) — a motor ugyanezt a kaput alkalmazza,
 *  és ugyanígy hagyja ki belőle a ritmust. */
export function measuredSubscores(day: MeWeekDay): number {
  const s = day.subscores
  return INTRINSIC_SUBSCORE_KEYS.filter((k) => s?.[k] != null).length
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
