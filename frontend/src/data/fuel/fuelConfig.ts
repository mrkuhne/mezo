// Fuel day-planner constants (Fuel P5). Pinned Global Constraints from the planner spec —
// the single source of truth for slot placement, snapping, weighting and recipe-fit math.
// Time helpers convert between 'HH:mm' wall-clock strings and minutes-since-midnight.

// Meal cadence + caffeine cutoff now live on Fuel settings (mezo-53su); the wake/bed day-anchor
// moved to the sleep goal (mezo-dbsr). What stays here are the pure placement/snapping constants.
export const EATING_START_OFFSET_MIN = 45
export const KITCHEN_CLOSE_OFFSET_MIN = 90
export const PRE_WORKOUT_SNAP_MIN = 75
export const POST_WORKOUT_SNAP_MIN = 45
export const DEFAULT_BLOCK_MIN = 60
export const MIN_SLOT_GAP_MIN = 90
export const SLOT_WEIGHT = { main: 2, snack: 1, postWorkoutMain: 2.5 } as const
export const RECIPE_FIT_TOLERANCE = 0.2
export const FAT_KCAL_SHARE = 0.275

// Diet split presets (Diet Plan slice 1) — fat energy-shares mirroring backend `mezo.goal.diet`
// (dietSplitDriftGuard.test.ts is the tripwire). FAT_KCAL_SHARE above stays as the no-segment fallback.
export const DIET_SPLIT_PRESETS: Record<'balanced' | 'low_fat' | 'low_carb' | 'high_carb', number> = {
  balanced: 0.275, low_fat: 0.2, low_carb: 0.4, high_carb: 0.22,
}

// Keret-hero rost-gyűrű (mezo-c9t5, frontend-only rost-bővítés). Static default target — no
// settings-field yet (scope-on-kívül a designban); consumed rost = the day's logged meals' summed
// `fiberG` (missing per-meal field counts as 0, keretHero.ts).
export const FIBER_TARGET_G = 30

// Dynamic energy model (mezo-1oy5). Daily target = BMR×NEAT + Σ MET-based activity + goal balance,
// where NEAT is read off `tdeeBootstrap.neat` from the wire (deriveDailyBudget) — not a static const here.
// MET by training-block kind — kcal = MET × weightKg × hours. Conservative (indoor volleyball has lots of standing).
export const MET_BY_KIND: Record<'gym' | 'sport' | 'run' | 'default', number> = { gym: 6.0, sport: 4.5, run: 9.5, default: 5.0 }
// Null-duration blocks (interval runs) use this for the burn estimate.
export const DEFAULT_RUN_MIN = 45
// A training block ≥ either threshold earns a peri-workout snack window.
export const PERI_SNACK_MIN_KCAL = 300
export const PERI_SNACK_MIN_DURATION = 90

// Meal-slot templates (mezo-7102). Role multipliers skew a slot's P/C/F share before per-macro
// normalization (splitBudgetPct) — pre-workout is carb-forward, post-workout protein-forward.
export const ROLE_MACRO_MULTIPLIERS: Record<'standard' | 'pre_workout' | 'post_workout', { p: number; c: number; f: number }> = {
  standard: { p: 1, c: 1, f: 1 },
  pre_workout: { p: 0.5, c: 1.6, f: 0.4 },
  post_workout: { p: 1.7, c: 1.1, f: 0.7 },
}
export const MAX_TEMPLATE_SLOTS = 8
export const PRE_WORKOUT_SLOT_WARN_PCT = 15
export const PRE_WORKOUT_SLOT_WARN_KCAL = 300
export const EVENING_SHARE_WARN = 0.4

/** 'HH:mm' → minutes since midnight. */
export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** minutes since midnight → zero-padded 'HH:mm', clamped to 00:00..23:59. */
export function toHHmm(min: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ── Wake→bed day span (mezo-rrtj fix wave item 8) ───────────────────────────────────────────────
// ONE shared midnight-crossing predicate, used everywhere a wall-clock time needs to be placed on
// the day's continuous minute axis (dayZones' zone buckets, FuelMaiPage's now-position pin). The
// previous `bedMin > 1440` re-derivation disagreed with this predicate exactly when bed === '00:00'
// (toMin('00:00') = 0 ⇒ unwrapped bedMin lands at EXACTLY 1440, so `> 1440` misses it) — always
// detect the crossing from `toMin(bed) <= toMin(wake)` instead, and unwrap through this helper.
export interface DaySpan {
  wakeMin: number
  /** Unwrapped bed minute — may exceed 1440 on a midnight-crossing day. */
  bedMin: number
  span: number
  crossesMidnight: boolean
}

/** The wake→bed span in minutes, unwrapping bed past midnight when it is at/before wake. */
export function daySpan(wake: string, bed: string): DaySpan {
  const wakeMin = toMin(wake)
  const crossesMidnight = toMin(bed) <= wakeMin
  const bedMin = crossesMidnight ? toMin(bed) + 1440 : toMin(bed)
  return { wakeMin, bedMin, span: Math.max(1, bedMin - wakeMin), crossesMidnight }
}

/** Unwrap an 'HH:mm' onto the same continuous minute axis as `daySpan`'s wakeMin — only past
 *  midnight when the DAY itself crosses midnight; otherwise an early-morning time (before wake)
 *  clamps forward into the first zone instead of jumping a day. */
export function unwrapDayMinute(hhmm: string, wakeMin: number, crossesMidnight: boolean): number {
  const raw = toMin(hhmm)
  return crossesMidnight && raw < wakeMin ? raw + 1440 : raw
}

// ── Time-of-day zones (mezo-rrtj) ────────────────────────────────────────────
// The Mai page groups the day's slots into four napszak zones. Boundaries are FRACTIONS of the
// user's wake→bed span (never wall-clock constants): wake/bed are owned by the sleep goal, so an
// early riser and a night owl must both get sensible buckets. Tuned on the reference day
// (06:45→23:00) so 13:00 lunch lands in `Dél`, a 17:00 gym in `Délután` and a 19:00 dinner in `Este`.
export const ZONE_KEYS = ['morning', 'midday', 'afternoon', 'evening'] as const
export type ZoneKeyName = (typeof ZONE_KEYS)[number]
export const ZONE_FRACTIONS: Record<ZoneKeyName, number> = {
  morning: 0, midday: 0.30, afternoon: 0.52, evening: 0.72,
}
export const ZONE_LABELS: Record<ZoneKeyName, string> = {
  morning: 'Reggel', midday: 'Dél', afternoon: 'Délután', evening: 'Este',
}
