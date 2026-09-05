// ============================================================
// Heti · nap-állapotok + nap-formázás (mezo-d20.6.10 → mezo-el0t)
// Source: en-body.html `dayCard()` / `dayPage()` / `daysPage()`.
//
// The ONE place the FOUR honest day states live (handoff §4) — now truly the
// only one. Until mezo-el0t this module and the sibling `dayScoreState.ts`
// BOTH claimed to be "the one place", under two different vocabularies
// (`scored/thin/empty/future` here, `scored/learning/nodata/future` there),
// and disagreed on the wire besides (`dayScoreState.isDayUnlogged` tested
// `proteinG`, `isEmptyDay` here did not) — the week hub and the mosaic could
// label the same day differently. `dayScoreState.ts` is gone; the hub reads
// this module (via `weekHub.ts`'s `weekHubState`, which is this file's
// `dayState` under a name its callers already used) exactly like the mosaic
// and the day page do. The backend's own state names (`empty`/`thin`) win
// over the hub's old `nodata`/`learning`, because `WeekDayPage` already reads
// them off the wire (`evaluation?.state`) — one vocabulary, not two:
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

// ── A napi motor hat dimenziója — EGY lista a heti mozaiknak ÉS a nap-oldalnak ────────────────
// mezo-jcpt.5 óta a `MeWeekDay.subscores` wire-alakja ugyanez a hat kulcs, ezért a korábbi
// négyes `SUBSCORES` lista megszűnt: az oka (a szűkebb heti wire-alak) elmúlt.
// A `barClass` mindkét felületen ugyanaz az `is-<key>` név, de KÉT KÜLÖN, scope-olt CSS-családot
// címez (`.dayev-dim.is-*` a nap-oldalon, `.wkd-sparks i.is-*` a heti csempén) — a két szabálycsalád
// most már azonos szemantikát kap, de egyiket sem szabad bare szelektorrá oldani.
const DAY_DIMENSION_KEYS = ['nutrition', 'quality', 'training', 'sleep', 'logging', 'rhythm'] as const
export type DayDimensionKey = (typeof DAY_DIMENSION_KEYS)[number]

/** `do` = amit a nap folyamán TETTÉL, `be` = ahogy a tested/ritmusod ÁLL. A heti csempe
 *  ezen a határon nyit egy szélesebb rést, hogy a hat pálcika legend nélkül is csoportosuljon. */
export type DimensionGroup = 'do' | 'be'

export const DAY_DIMENSIONS: readonly {
  key: DayDimensionKey; label: string; barClass: string; group: DimensionGroup
}[] = [
  { key: 'nutrition', label: 'tápanyag', barClass: 'is-nutrition', group: 'do' },
  { key: 'quality', label: 'minőség', barClass: 'is-quality', group: 'do' },
  { key: 'training', label: 'edzés', barClass: 'is-training', group: 'do' },
  { key: 'sleep', label: 'alvás', barClass: 'is-sleep', group: 'be' },
  { key: 'logging', label: 'logolás', barClass: 'is-logging', group: 'be' },
  { key: 'rhythm', label: 'ritmus', barClass: 'is-rhythm', group: 'be' },
]

/** A `rhythm` KIMARAD: extrinsic jel — MÁS napok base-scoreainak átlaga
 *  (`DayEvaluationEngine` javadoc :93-97), ezért egy érintetlen napon is lehet értéke.
 *  A motor is kihagyja a saját adat-elegendőségi kapujából; minden „mennyit mértünk ezen a
 *  napon" próba ezt a listát használja, nem a teljes hatot. */
export const INTRINSIC_SUBSCORE_KEYS: readonly DayDimensionKey[] =
  ['nutrition', 'quality', 'training', 'sleep', 'logging']

export function subscoreCount(day: MeWeekDay): number {
  return INTRINSIC_SUBSCORE_KEYS.filter((k) => day.subscores[k] != null).length
}

/** Count of day-page dimensions with real data (`DONE`) — the day-page analogue of
 *  `subscoreCount` above, over the evaluation endpoint's `dimensions[]` instead of
 *  `MeWeekDay.subscores`. Takes any `{ status }[]` (not `DayDimension[]`) so it needs no
 *  import from the generated API types. */
export function doneDimensionCount(dimensions: readonly { status: string }[]): number {
  return dimensions.filter((d) => d.status === 'DONE').length
}

/** True when NOTHING was logged on the day — the `nincs adat` state, distinct from `tanulom`.
 *  The prototype checks kcal/sleep/check-in/workout; the real contract also carries a per-day
 *  weight and XP, and a logged weight IS a log, so both join the test (see the slice report).
 *
 *  `proteinG` joins the test too (mezo-el0t) — the mirrored decision to `DayEvaluationEngine
 *  .anyLogPresent`'s own `kcal`/`meals` pair (companion service, backend). There, `kcal` and a
 *  non-empty meal list are checked as a defensive DISJUNCT of the SAME fact ("a meal was
 *  logged"), because in production `kcal` is only ever non-null once a meal exists. `proteinG`
 *  is the frontend's analogue: it is populated from the same meal aggregation as `kcal` (see
 *  `data/me/meWeek.ts` — every mock day carries both together, or neither), so a day with a
 *  logged protein value already has a logged kcal value in practice. Including it here is the
 *  same harmless, intentional redundancy as the backend's — not a second, competing signal. */
export function isEmptyDay(day: MeWeekDay): boolean {
  return subscoreCount(day) === 0
    && day.kcal == null && day.proteinG == null && day.sleepMin == null && day.weightKg == null
    && !day.checkinCount && !day.workoutCount && !day.xp
}

/** The positive reading of `isEmptyDay` — true when the day carries ANY logged signal at all.
 *  Kept as its own name (not just `!isEmptyDay(...)` inline at call sites) because "you logged
 *  nothing" and "you logged too little to score" are different sentences to a user, and the
 *  name should say which one a caller means. */
export function dayHasAnyLog(day: MeWeekDay): boolean {
  return !isEmptyDay(day)
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
    'A hat pálcika a nap részpontszáma. A „tanulom" azt jelenti: kevesebb mint két területről van adat — '
    + 'nem azt, hogy nulla volt a nap.',
} as const

/** The short state word that stands where a score would be — the week hub's mini-ring
 *  accessible name and score-bar column name (mezo-el0t: formerly `dayScoreState.ts`'s
 *  `DAY_STATE_LABEL`, under the `learning`/`nodata` vocabulary). Never `0`, never `—` passed
 *  off as a value: `—` is the missing-datum glyph, these are STATES. */
export const DAY_STATE_LABEL: Record<WeekDayState, string> = {
  scored: '',
  thin: 'tanulom',
  empty: 'nincs adat',
  future: 'még előtted',
}

/** The one-sentence reading of each non-scored state — the week hub's mini-ring tooltip
 *  (mezo-el0t: formerly `dayScoreState.ts`'s `DAY_STATE_COPY`). Reuses `DAY_COPY`'s verbatim
 *  sentences rather than inventing a third set of copy for the same three facts. */
export const DAY_STATE_COPY: Record<WeekDayState, string> = {
  scored: '',
  thin: DAY_COPY.thinPage,
  empty: DAY_COPY.emptyTile,
  future: DAY_COPY.futureTile,
}

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
