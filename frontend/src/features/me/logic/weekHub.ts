// ============================================================
// Heti hub — pure derivations (mezo-d20.6.10)
// Source: docs/design_2.0/prototypes/src/en-body.html, the `Heti áttekintés`
// IIFE (`hub()`, `statCells()`, `firstSent()`, `band()`), plus the honest-state
// contract table in docs/design_2.0/2026-08-28-heti-implementation-handoff.md §4.
//
// Everything the hub decides — which honest state a day is in, what the hero's
// sub-line says, how a stat cell reads, what the analysis tile's generation
// stamp is — lives here so it is unit-testable without rendering, and so the
// sibling Heti pages (elemzés / tanulságok / napok / felfedezések) can reuse the
// SAME rules instead of re-deriving them. The 80/70 score thresholds are NOT
// here: they live in `scoreBand.ts` and nowhere else.
// ============================================================
import { huInt } from '@/shared/lib/huNum'
import { huWeekdayFull } from '@/shared/lib/dates'
import type { MeWeekAggregates, MeWeekDay } from '@/data/me/meWeek'
import type { WeeklyReview, WeeklyReviewDigest } from '@/data/me/weeklyReviewHooks'

// The week-URL and day-state rules are shared with every sibling Heti page and are
// therefore declared ONCE, elsewhere; re-exported here so the hub keeps a single
// import surface (mezo-d20.6.10 integration — three slices had each grown their own copy).
//
// `weekHubState` is `dayState` under the name the hub already called it (mezo-el0t): the hub
// used to run its OWN derivation (`dayScoreState.ts`, since deleted) that disagreed with the
// mosaic's on the `proteinG` edge case. It is now a bare re-export, not a second function that
// merely happens to agree — there is nothing left to drift.
export { resolveWeekStart, weekHubPath } from '@/features/me/logic/weekNav'
export {
  type WeekDayState as DayScoreState, dayState as weekHubState, isEmptyDay, dayHasAnyLog,
  subscoreCount, DAY_STATE_LABEL, DAY_STATE_COPY,
} from '@/features/me/logic/weekDay'

/** Hungarian one-decimal that KEEPS the ",0" (the prototype's `hu1`, which sets
 *  minimumFractionDigits: 1 — "7,0", not the shared `hu1`'s "7"). */
export function huDec(value: number, digits = 1): string {
  const neg = value < 0
  const text = Math.abs(value).toFixed(digits).replace('.', ',')
  // U+2212 MINUS SIGN, as everywhere else in the HU numerals.
  return neg ? `−${text}` : text
}


// ── the four honest day states (handoff §4) ───────────────────────────────
// The states themselves (`scored`/`thin`/`empty`/`future`) live in `weekDay.ts` and are
// re-exported above as `weekHubState`; the two non-scored ones, spelled out:
//   thin  (tanulom)    = you logged something, but from fewer than two areas — the Mezo
//                        refuses to invent a score from one signal;
//   empty (nincs adat) = you logged nothing at all, and the day does not drag the week's
//                        score down either (it is simply not in the average).
/** Days that actually carry a score — the `5 / 7 nap` numerator and the analysis
 *  tile's `napi pontszám · N / 7 nap` footer (the prototype's `logged`). */
export function loggedDayCount(days: readonly MeWeekDay[]): number {
  return days.filter((d) => d.score != null).length
}

// ── hero ───────────────────────────────────────────────────────────────────

export type WeekPhase = 'closed' | 'running' | 'future'

export function weekPhase(startIso: string, todayMondayIso: string): WeekPhase {
  if (startIso === todayMondayIso) return 'running'
  return startIso < todayMondayIso ? 'closed' : 'future'
}

/** The hero's sub-line. Derived, never hardcoded: a closed week WITHOUT a review must
 *  not claim „a Mezo elemzésével". When the week has no score at all the contract
 *  sentence (handoff §4, „hét <2 mért nap") takes the line instead — that is the more
 *  useful truth than which phase the week is in. */
export function weekSubline(phase: WeekPhase, hasReview: boolean, score: number | null | undefined): string {
  if (phase === 'future') return 'még előtted'
  if (score == null) return 'még gyűjtöm az adatokat a heti értékeléshez'
  if (phase === 'running') return 'ez a hét · még fut'
  return hasReview ? 'lezárt hét · a Mezo elemzésével' : 'lezárt hét · elemzés nélkül'
}

// ── analysis tile ──────────────────────────────────────────────────────────

/** The prototype's `firstSent()` — the tile shows one sentence, the page shows the prose. */
export function firstSentence(text: string): string {
  const i = text.indexOf('. ')
  return i > 0 ? text.slice(0, i + 1) : text
}

export type GenStampTone = 'lav' | 'warn'
export interface GenStamp { text: string; tone: GenStampTone }

/** `hétfő 06:15` when generated · `hétfőn jön` on a running week · `nincs még` on a
 *  closed week with no review. The timestamp is rendered in the viewer's local zone. */
export function generationStamp(review: WeeklyReview | null, phase: WeekPhase): GenStamp {
  if (review?.generatedAt) {
    const d = new Date(review.generatedAt)
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return { text: `${huWeekdayFull(d).toLowerCase()} ${hh}:${mm}`, tone: 'lav' }
    }
  }
  return { text: phase === 'running' ? 'hétfőn jön' : 'nincs még', tone: 'warn' }
}

/** The analysis tile's body text. The two ghost branches are the handoff §4 contracts —
 *  a CLOSED week with no review must NOT reuse the running week's „hétfő reggel érkezik". */
export function analysisSnippet(review: WeeklyReview | null, phase: WeekPhase): string {
  if (review) return firstSentence(review.summary)
  if (phase === 'closed') {
    return 'Ez a hét lezárt, de nem készült elemzés — a hét adatai megvannak, bármikor pótolható.'
  }
  return 'Hétfő reggel érkezik — a Mezo a lezárt hét adataiból írja meg. Addig gyűlnek a napok.'
}

// ── discoveries tile ───────────────────────────────────────────────────────

export type DiscoveryDot = 'pattern' | 'fact' | 'life' | 'memoir' | 'prediction'
export interface DiscoverySummary { count: number; parts: string[]; dots: DiscoveryDot[] }

export function discoverySummary(digest: WeeklyReviewDigest | null): DiscoverySummary {
  const patterns = digest?.patterns ?? []
  const facts = digest?.newFacts ?? []
  const life = digest?.lifeEvents ?? []
  const predictions = digest?.predictions ?? []
  const memoir = digest?.memoir === true

  const parts: string[] = []
  if (patterns.length) parts.push(`${patterns.length} minta`)
  if (facts.length) parts.push(`${facts.length} új tudás`)
  if (life.length) parts.push(`${life.length} életesemény`)
  if (memoir) parts.push('memoár')
  if (predictions.length) parts.push(`${predictions.length} előrejelzés`)

  const dots: DiscoveryDot[] = [
    ...patterns.map((): DiscoveryDot => 'pattern'),
    ...facts.map((): DiscoveryDot => 'fact'),
    ...life.map((): DiscoveryDot => 'life'),
    ...(memoir ? (['memoir'] as DiscoveryDot[]) : []),
    ...predictions.map((): DiscoveryDot => 'prediction'),
  ]

  return { count: dots.length, parts, dots }
}

// ── the eight mini-cells ───────────────────────────────────────────────────

export type WeekCellTone = 'lav' | 'sage' | 'sky' | 'coral' | 'amber' | 'rose'
export interface WeekStatCell { label: string; value: string; unit: string | null; tone: WeekCellTone }

function sleepHm(min: number | null | undefined): string {
  if (min == null) return '—'
  return `${Math.floor(min / 60)}ó ${Math.round(min % 60)}p`
}

/**
 * The eight cells, in the prototype's order and tone palette. `avgCheckinEnergy`
 * (Energia) and `latestWeightKg` (Súly) are the two the backend has always returned
 * and the old UI threw away. Missing data is `—` and NEVER a zero.
 */
export function weekStatCells(weekly: MeWeekAggregates): WeekStatCell[] {
  return [
    { label: 'Kcal átlag', value: weekly.avgKcal != null ? huInt(weekly.avgKcal) : '—',
      unit: weekly.avgKcal != null ? 'kcal' : null, tone: 'lav' },
    { label: 'Fehérje', value: weekly.avgProteinG != null ? huInt(weekly.avgProteinG) : '—',
      unit: weekly.avgProteinG != null ? 'g' : null, tone: 'sage' },
    { label: 'Alvás', value: sleepHm(weekly.avgSleepMin), unit: null, tone: 'sky' },
    { label: 'Check-in', value: weekly.checkinRatio != null ? String(Math.round(weekly.checkinRatio * 100)) : '—',
      unit: weekly.checkinRatio != null ? '%' : null, tone: 'coral' },
    { label: 'Energia', value: weekly.avgCheckinEnergy != null ? huDec(weekly.avgCheckinEnergy) : '—',
      unit: weekly.avgCheckinEnergy != null ? '/ 10' : null, tone: 'amber' },
    { label: 'Súly', value: weekly.latestWeightKg != null ? huDec(weekly.latestWeightKg) : '—',
      unit: weekly.latestWeightKg != null ? 'kg' : null, tone: 'sky' },
    { label: 'Súly-trend', value: weekly.weightWeeklyRateKg != null ? huDec(weekly.weightWeeklyRateKg, 2) : '—',
      unit: weekly.weightWeeklyRateKg != null ? 'kg/hét' : null, tone: 'sage' },
    { label: 'XP', value: weekly.totalXp != null ? huInt(weekly.totalXp) : '—', unit: null, tone: 'rose' },
  ]
}
