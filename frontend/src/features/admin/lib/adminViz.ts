// Admin hub viz helpers (mezo-d5iy.19) — small, page-local series/scale/color maths that used to
// be duplicated (or reimplemented under a different formula) across the admin pages. Consolidated
// here, behavior unchanged at every call site; each function keeps the comment explaining its own
// origin/shape so a future reader isn't left guessing why two "heat color" functions still don't
// look alike.

/** Sum a set of per-domain day-series into one totals-per-day array (AdminOverviewPage's
 *  "Logolt sorok · 30 nap" tile: several domains' `days[]`, same length, summed index-by-index). */
export function sumSeriesByDay(series: { days: { count: number }[] }[]): number[] {
  if (series.length === 0) return []
  const n = series[0].days.length
  return Array.from({ length: n }, (_, i) => series.reduce((sum, s) => sum + (s.days[i]?.count ?? 0), 0))
}

/** Max of a plain number array, 0 for an empty one (AdminOverviewPage's sparkline "csúcs" stat). */
export function peak(vals: number[]): number {
  return vals.length ? Math.max(...vals) : 0
}

/** A row's share of the table with the most rows, as a 0–100 percentage rounded to 1 decimal
 *  (AdminUserDetailPage's per-table footprint bar). */
export function footprintShare(n: number, all: { rowCount: number }[]): number {
  const max = Math.max(1, ...all.map((r) => r.rowCount))
  return Math.round((n / max) * 1000) / 10
}

/** Max value across a `{ key: count }` usage record, 1 for an empty one so a `value / max` never
 *  divides by zero (AdminUserDetailPage's feature-usage bars). */
export function maxOf(rec: Record<string, number>): number {
  const vals = Object.values(rec)
  return vals.length ? Math.max(...vals) : 1
}

/** Fixed-hue (admin coral) heat color for the 90-day activity heat strip: alpha alone carries the
 *  value, scaled 0.22–1.0 against the strip's own max, a flat neutral tint at zero. This is NOT
 *  `hexToRgba` below — different color, different alpha curve, kept as its own function rather
 *  than forced through a single "heat" abstraction the two call sites don't actually share. */
export function heatColor(v: number, max: number): string {
  if (!v) return 'rgba(43,33,24,.07)'
  const t = 0.22 + 0.78 * (v / max)
  return `rgba(216,72,31,${t.toFixed(2)})`
}

/** Any hex color at a given alpha, as an rgba() string (MatrixGrid's feature×day cell tint —
 *  `color` is caller-supplied, unlike `heatColor`'s fixed coral, so this stays a general hex→rgba
 *  conversion rather than another fixed-hue heat function). */
export function hexToRgba(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`
}
