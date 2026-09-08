import type { AdminCostMatrixResponse, AdminUserInsightResponse } from '@/data/admin/adminInsightsApi'
import { featureLabel } from '@/features/admin/lib/labels'
import type { TopRow } from '@/features/admin/components/TopListTile'

// Admin hub viz helpers (mezo-d5iy.19) — small, page-local series/scale/color maths that used to
// be duplicated (or reimplemented under a different formula) across the admin pages. Consolidated
// here, behavior unchanged at every call site; each function keeps the comment explaining its own
// origin/shape so a future reader isn't left guessing why two "heat color" functions still don't
// look alike.

/** A single aggregated total, pre-`topNFromEntries` — the shape `costMatrixTotals` returns and
 *  `topNFromEntries` consumes (mezo-m079 Task 2). `sub` is optional: only the cost-matrix's
 *  Háttér (background/cron) bucket carries one today. */
export interface AdminVizEntry {
  key: string
  label: string
  value: number
  sub?: string
}

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

/** Per-axis totals from the user×feature cost matrix (mezo-m079 Task 2) — the sole aggregation
 *  step `topNFromEntries` needs a plain `{key,label,value}[]` for. `'feature'` labels through the
 *  slice-0 dictionary (raw feature slugs never render); `'user'` uses the matrix's own
 *  `users[].label` (already `'Háttér'` for the null-id background/cron bucket — see
 *  ADMIN_COST_MATRIX_MOCK's own comment) and additionally tags that one bucket with
 *  `sub: 'rendszer'` so the tile can visually distinguish it from a real tester. */
export function costMatrixTotals(
  matrix: AdminCostMatrixResponse,
  axis: 'user' | 'feature',
): AdminVizEntry[] {
  if (axis === 'feature') {
    return matrix.features.map((feature) => ({
      key: feature,
      label: featureLabel(feature).label,
      value: matrix.cells
        .filter((c) => c.feature === feature)
        .reduce((sum, c) => sum + c.costUsd, 0),
    }))
  }
  return matrix.users.map((u) => ({
    key: u.id ?? '__background__',
    label: u.label,
    sub: u.id === null ? 'rendszer' : undefined,
    value: matrix.cells
      .filter((c) => c.userId === u.id)
      .reduce((sum, c) => sum + c.costUsd, 0),
  }))
}

/** Sorts entries desc by value, keeps the top `n`, and shapes them into `TopRow`s: `share` is
 *  each kept entry's value relative to the max VALUE AMONG THE KEPT ROWS (mezo-m079 Task 2) —
 *  since the list is sorted first, that max is always the leading row's own value, so the
 *  leader's bar is always full and every other bar reads as "share of the leader". `fmt` renders
 *  the raw number into the row's display string (e.g. `usd`/`huInt`). */
export function topNFromEntries(
  entries: AdminVizEntry[],
  n: number,
  fmt: (value: number) => string,
): TopRow[] {
  const top = [...entries].sort((a, b) => b.value - a.value).slice(0, n)
  const max = Math.max(1, ...top.map((e) => e.value))
  return top.map((e) => ({
    key: e.key,
    label: e.label,
    sub: e.sub,
    value: fmt(e.value),
    share: e.value / max,
  }))
}

/** Yesterday's value vs. the average of the prior `days` values (mezo-m079 Task 2), the shared
 *  "Δ vs trailing average" reading used for cost/activity deltas. `series` is a plain chronological
 *  array whose LAST element is "yesterday"; a shorter series is padded with 0s for the missing
 *  days rather than averaging over fewer days (a single real day should not look like a bigger
 *  swing just because history is thin). `fromZero: true` marks a trailing average of 0 — a
 *  percentage cannot be computed from nothing, so `pct` is reported as 0 and the caller should
 *  read `direction` instead ('up' when yesterday is >0 off a zero base, 'flat' when both are 0). */
export function deltaVsTrailingAvg(
  series: number[],
  days = 7,
): { pct: number; direction: 'up' | 'down' | 'flat'; fromZero: boolean } {
  if (series.length === 0) return { pct: 0, direction: 'flat', fromZero: true }
  const yesterday = series[series.length - 1]
  const prior = series.slice(Math.max(0, series.length - 1 - days), series.length - 1)
  const avg = prior.reduce((sum, v) => sum + v, 0) / days
  if (avg === 0) {
    return { pct: 0, direction: yesterday === 0 ? 'flat' : 'up', fromZero: true }
  }
  const pct = ((yesterday - avg) / avg) * 100
  const direction = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat'
  return { pct, direction, fromZero: false }
}

/** A legend slice — like `AdminVizEntry` but carrying the label dictionary's own `missing` flag
 *  through instead of discarding it (mezo-m079 Task 3), so a legend can render the honest
 *  "nincs címke" marker next to a raw key the label dictionary doesn't recognize. */
export interface AdminLegendEntry {
  key: string
  label: string
  missing?: boolean
  value: number
}

/** Per-domain 30-day totals for the Pulzus "Aktivitás 30 nap" tile's legend (mezo-m079 Task 3):
 *  every domain's own total (NOT summed across domains like `sumSeriesByDay` — this is one row
 *  per domain, that function's one row per DAY), labelled through `featureLabel` (the activity
 *  domains share the same dictionary as the LLM feature slugs — see labels.ts's own comment). */
export function domainTotals(series: { key: string; days: { count: number }[] }[]): AdminLegendEntry[] {
  return series.map((s) => {
    const lbl = featureLabel(s.key)
    return { key: s.key, label: lbl.label, missing: lbl.missing, value: s.days.reduce((sum, d) => sum + d.count, 0) }
  })
}

/** Top-`n` feature costs + one "Egyéb" remainder bucket, for the Pulzus "Költés 30 nap" tile's
 *  legend (mezo-m079 Task 3). Deliberately does its own per-feature summing rather than calling
 *  `costMatrixTotals` + re-deriving `missing` from the label a second time — that would either
 *  duplicate the label lookup or need `costMatrixTotals`'s shared, already-tested return shape
 *  widened for this one caller. `matrix.totalUsd` (not a re-sum of `cells`) is the remainder's
 *  base, per the page's own "the cost matrix is the SOLE source of the 30-day total" rule. */
export function featureLegend(matrix: AdminCostMatrixResponse, n: number): AdminLegendEntry[] {
  const totals: AdminLegendEntry[] = matrix.features.map((f) => {
    const lbl = featureLabel(f)
    const value = matrix.cells.filter((c) => c.feature === f).reduce((sum, c) => sum + c.costUsd, 0)
    return { key: f, label: lbl.label, missing: lbl.missing, value }
  })
  const top = [...totals].sort((a, b) => b.value - a.value).slice(0, n)
  const rest = Math.max(0, matrix.totalUsd - top.reduce((sum, e) => sum + e.value, 0))
  const result = [...top]
  if (rest > 0.004) result.push({ key: '__other__', label: 'Egyéb', value: rest })
  return result
}

/** Non-owner users quiet for at least `minDays`, quietest first — the Pulzus "Csendes
 *  tesztelők" tile (mezo-m079 Task 3). A user who has NEVER been active (`lastActivityAt: null`)
 *  is the quietest of all, sorted first, but gets an honest "még nem aktív" row instead of an
 *  invented day count. `now` is injectable so a test never depends on the real clock. */
export function quietTesters(
  users: Pick<AdminUserInsightResponse, 'id' | 'name' | 'role' | 'lastActivityAt'>[],
  now: Date = new Date(),
  minDays = 3,
): TopRow[] {
  const withDays = users
    .filter((u) => u.role !== 'OWNER')
    .map((u) => ({
      u,
      days: u.lastActivityAt == null ? null : Math.floor((now.getTime() - new Date(u.lastActivityAt).getTime()) / 86_400_000),
    }))
    .filter((x) => x.days === null || x.days >= minDays)
    .sort((a, b) => (b.days ?? Number.POSITIVE_INFINITY) - (a.days ?? Number.POSITIVE_INFINITY))

  const maxDays = Math.max(1, ...withDays.map((x) => x.days ?? 0))
  return withDays.map(({ u, days }) => ({
    key: u.id,
    label: u.name,
    value: days === null ? 'még nem aktív' : `${days} napja`,
    share: days === null ? 1 : days / maxDays,
    to: `/admin/users/${u.id}`,
  }))
}
