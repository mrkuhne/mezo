// ============================================================
// Heti · nap-állapotok + nap-formázás (mezo-d20.6.10)
// Source: en-body.html `dayCard()` / `dayPage()` / `daysPage()`.
//
// The one place the FOUR honest day states live (handoff §4). Today's
// `WeekDayCard` conflates two of them into a single `—`; the design
// insists they are different sentences:
//
//   scored  — the Mezo scored the day
//   thin    — something was logged, but fewer than TWO sub-scores have
//             data, so no score is given ("tanulom" — not a zero)
//   empty   — nothing was logged at all ("nincs adat" — the day does not
//             even count against the week)
//   future  — the day has not happened yet
//
// Everything here is pure so the contracts can be tested without a DOM.
// ============================================================
import { addDays, localDateString } from '@/shared/lib/dates'
import type { MeWeekDay } from '@/data/me/meWeek'
import type { WeeklyReview } from '@/data/me/weeklyReviewMock'

export type WeekDayState = 'scored' | 'thin' | 'empty' | 'future'

const SUBSCORE_KEYS = ['sleep', 'fuel', 'checkin', 'activity'] as const
export type SubscoreKey = (typeof SUBSCORE_KEYS)[number]

/** The four sub-scores, in the prototype's bar order (alvás · fuel · check-in · aktivitás). */
export const SUBSCORES: readonly { key: SubscoreKey; label: string; barClass: string }[] = [
  { key: 'sleep', label: 'alvás', barClass: 'is-sleep' },
  { key: 'fuel', label: 'fuel', barClass: 'is-fuel' },
  { key: 'checkin', label: 'check-in', barClass: 'is-checkin' },
  { key: 'activity', label: 'aktivitás', barClass: 'is-activity' },
]

/** The day-page sub-ring labels — the prototype abbreviates "aktivitás" to "aktív" there. */
export const SUBRING_LABEL: Record<SubscoreKey, string> = {
  sleep: 'alvás', fuel: 'fuel', checkin: 'check-in', activity: 'aktív',
}

export function subscoreCount(day: MeWeekDay): number {
  return SUBSCORE_KEYS.filter((k) => day.subscores[k] != null).length
}

// ── Day-page six dimensions (mezo-jcpt.4) ─────────────────────────────────────
// The evaluation endpoint's `DayDimension.id`s, in the config-weight order (constraints.md:
// nutrition .30 · quality .15 · training .20 · sleep .15 · logging .10 · rhythm .10). This is
// DELIBERATELY separate from `SUBSCORES`/`SUBRING_LABEL` above: those stay bound to
// `MeWeekDay.subscores`'s four-key wire shape for the weekly mosaic (WeekScoreBars/WeekDayTile),
// which is unchanged by this slice. The six dimensions belong to the DAY PAGE only, sourced
// from `useDayEvaluation` (Task 10 wires the UI on top of these exports).
const DAY_DIMENSION_KEYS = ['nutrition', 'quality', 'training', 'sleep', 'logging', 'rhythm'] as const
export type DayDimensionKey = (typeof DAY_DIMENSION_KEYS)[number]

/** The six day-page dimension bars, in bar order. `barClass` follows the existing `is-sleep`
 *  naming pattern (`is-<key>`) — Task 10 backs each with its own CSS token (sage/gold/coral/
 *  lav/rose/sky per constraints.md), scoped to the day page's own container so it never
 *  collides with the weekly mosaic's identically-named-by-coincidence `is-sleep` class (which
 *  carries a DIFFERENT color there — sky, not lav). */
export const DAY_DIMENSIONS: readonly { key: DayDimensionKey; label: string; barClass: string }[] = [
  { key: 'nutrition', label: 'tápanyag', barClass: 'is-nutrition' },
  { key: 'quality', label: 'minőség', barClass: 'is-quality' },
  { key: 'training', label: 'edzés', barClass: 'is-training' },
  { key: 'sleep', label: 'alvás', barClass: 'is-sleep' },
  { key: 'logging', label: 'logolás', barClass: 'is-logging' },
  { key: 'rhythm', label: 'ritmus', barClass: 'is-rhythm' },
]

/** Count of day-page dimensions with real data (`DONE`) — the day-page analogue of
 *  `subscoreCount` above, over the evaluation endpoint's `dimensions[]` instead of
 *  `MeWeekDay.subscores`. Takes any `{ status }[]` (not `DayDimension[]`) so it needs no
 *  import from the generated API types. */
export function doneDimensionCount(dimensions: readonly { status: string }[]): number {
  return dimensions.filter((d) => d.status === 'DONE').length
}

/** True when NOTHING was logged on the day — the `nincs adat` state, distinct from `tanulom`.
 *  The prototype checks kcal/sleep/check-in/workout; the real contract also carries a per-day
 *  weight and XP, and a logged weight IS a log, so both join the test (see the slice report). */
export function isEmptyDay(day: MeWeekDay): boolean {
  return subscoreCount(day) === 0
    && day.kcal == null && day.sleepMin == null && day.weightKg == null
    && !day.checkinCount && !day.workoutCount && !day.xp
}

/** `todayIso` defaults to the device's local today — a day AFTER it has not happened yet. */
export function dayState(day: MeWeekDay, todayIso: string = localDateString()): WeekDayState {
  if (day.date > todayIso) return 'future'
  if (day.score != null) return 'scored'
  return isEmptyDay(day) ? 'empty' : 'thin'
}

// ── Honest-state copy (handoff §4) — verbatim, never paraphrased ──────────────
export const DAY_COPY = {
  /** mosaic tile, fewer than two sub-scores */
  thinTile: 'kevesebb mint két területről van adat, ezért nincs pontszám',
  /** mosaic tile, nothing logged */
  emptyTile: 'ezen a napon nem logoltál — a hét pontszámába nem számít bele',
  /** mosaic tile, the day is still ahead */
  futureTile: 'még előtted — ide majd a nap adatai jönnek',
  /** day page, fewer than two sub-scores */
  thinPage: 'Kettőnél kevesebb területről van adat, ezért a Mezo nem ad pontszámot: kitalálni nem fog.',
  /** day page, nothing logged */
  emptyPage: 'Egyik területről sincs adat — a nap a heti pontszámba sem számít bele.',
  /** day page, the day is still ahead */
  futurePage: 'Ez a nap még előtted van — ide majd a logolt adatai kerülnek.',
  /** day page, the review exists but wrote nothing about this day */
  noNote: 'A heti elemzés nem írt külön ehhez a naphoz — a Mezo csak azokhoz a napokhoz ír, ahol volt mit mondani.',
  /** day page, there is no review at all yet */
  noReview: 'A heti elemzés nem írt külön ehhez a naphoz — az elemzés még nem készült el.',
  footnote:
    'A négy pálcika a nap részpontszáma. A „tanulom" azt jelenti: kevesebb mint két területről van adat — '
    + 'nem azt, hogy nulla volt a nap.',
} as const

/** The mosaic tile's big slot: the score, or the state's word (never a fabricated 0). */
export function tileScoreLabel(state: WeekDayState): string | null {
  if (state === 'thin') return 'tanulom'
  if (state === 'empty') return 'nincs adat'
  return null
}

/** The day-page ring's two lines when there is no score. */
export function ringLearningLabels(state: WeekDayState): { label: string; caption: string } {
  return state === 'empty' ? { label: 'nincs', caption: 'adat' } : { label: 'tanulom', caption: 'még gyűlik' }
}

// ── Formatting ────────────────────────────────────────────────────────────────

const HU_DOW_SHORT = ['Vas', 'Hét', 'Kedd', 'Sze', 'Csü', 'Pén', 'Szo']
const HU_DOW_FULL = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat']

function dowIndex(dateIso: string): number {
  const [y, m, d] = dateIso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

/** '2026-05-20' → 'Sze' — the TRUE weekday, derived from the date (the retired score-bar
 *  axis hardcoded `['H','K','Sz','Cs','P','Sz','V']`, where Sze and Szo collided). */
export function huDowShort(dateIso: string): string {
  return HU_DOW_SHORT[dowIndex(dateIso)]
}

/** '2026-05-20' → 'Szerda' — the day page's hero name. */
export function huDowFull(dateIso: string): string {
  return HU_DOW_FULL[dowIndex(dateIso)]
}

/** 445 → '7ó 25p'. */
export function fmtSleep(min: number): string {
  return `${Math.floor(min / 60)}ó ${min % 60}p`
}

/** 3004 → '3 004' (HU thin-space grouping, as the prototype's `huInt`). */
export function huInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** 83.9 → '83,9', −0.3 → '−0,3' (HU decimal comma + U+2212). */
export function hu1(n: number): string {
  return n.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace('-', '−')
}

// ── Week-level derivations ────────────────────────────────────────────────────

export interface DaysSummary {
  /** days that actually got a score */
  measured: number
  best: MeWeekDay | null
  worst: MeWeekDay | null
  /** days that happened but stayed unscored (`tanulom` + `nincs adat`) */
  learning: number
}

export function summariseDays(days: readonly MeWeekDay[], todayIso: string = localDateString()): DaysSummary {
  let measured = 0, learning = 0
  let best: MeWeekDay | null = null, worst: MeWeekDay | null = null
  for (const d of days) {
    const st = dayState(d, todayIso)
    if (st === 'future') continue
    if (st !== 'scored' || d.score == null) { learning += 1; continue }
    measured += 1
    if (best?.score == null || d.score > best.score) best = d
    if (worst?.score == null || d.score < worst.score) worst = d
  }
  return { measured, best, worst, learning }
}

/** The one-line verdict under the day-page hero. */
export function dayVerdict(day: MeWeekDay, days: readonly MeWeekDay[], todayIso?: string): string {
  const state = dayState(day, todayIso)
  if (state === 'future') return 'még előtted'
  if (state === 'empty') return 'ezen a napon nem logoltál'
  if (state === 'thin') return 'kevés adat a pontszámhoz'
  const { best } = summariseDays(days, todayIso)
  return `a hét ${best?.score != null && day.score === best.score ? 'legjobb' : 'egyik'} napja`
}

/** Mezo's note about this exact day, or null — the review only writes where it had something. */
export function dayNoteFor(review: WeeklyReview | null | undefined, dateIso: string): string | null {
  return review?.dayNotes.find((n) => n.date === dateIso)?.note ?? null
}

// ── `:date` route param ───────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** True only for a real calendar date in `YYYY-MM-DD` form (rejects `2026-02-31`). */
export function isValidIsoDate(raw: string | undefined | null): raw is string {
  if (!raw || !ISO_DATE.test(raw)) return false
  const [y, m, d] = raw.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** The ISO Monday of the week containing `dateIso` — how `/me/week/napok/:date` finds its week
 *  when `?start=` is absent (a push notification deep-links the day alone). */
export function mondayOf(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return addDays(dateIso, -((dt.getDay() + 6) % 7))
}

/** True when `dateIso` falls inside the 7-day window starting at `startIso`. A `?start=` that
 *  does NOT contain the date is ignored rather than rendering a day from another week. */
export function isInWeek(dateIso: string, startIso: string): boolean {
  return dateIso >= startIso && dateIso <= addDays(startIso, 6)
}
