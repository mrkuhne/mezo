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

// Dynamic energy model (mezo-1oy5). Daily target = BMR×NEAT + Σ MET-based activity + goal balance,
// where NEAT is read off `tdeeBootstrap.neat` from the wire (deriveDailyBudget) — not a static const here.
// MET by training-block kind — kcal = MET × weightKg × hours. Conservative (indoor volleyball has lots of standing).
export const MET_BY_KIND: Record<'gym' | 'sport' | 'run' | 'default', number> = { gym: 6.0, sport: 4.5, run: 9.5, default: 5.0 }
// Null-duration blocks (interval runs) use this for the burn estimate.
export const DEFAULT_RUN_MIN = 45
// A training block ≥ either threshold earns a peri-workout snack window.
export const PERI_SNACK_MIN_KCAL = 300
export const PERI_SNACK_MIN_DURATION = 90

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
