import type { AdminCostMatrixResponse, AdminUserInsightResponse, AdminFeatureRow } from '@/data/admin/adminInsightsApi'
import { featureLabel } from '@/features/admin/lib/labels'
import type { TopRow } from '@/features/admin/components/TopListTile'

// Admin hub viz helpers (mezo-d5iy.19) — small, page-local series/scale/color maths that used to
// be duplicated (or reimplemented under a different formula) across the admin pages. Consolidated
// here, behavior unchanged at every call site; each function keeps the comment explaining its own
// origin/shape so a future reader isn't left guessing why two "heat color" functions still don't
// look alike.

/** A single aggregated total, pre-`topNFromEntries` — the shape `costMatrixTotals` returns and
 *  `topNFromEntries` consumes (mezo-m079 Task 2). `sub` is optional: only the cost-matrix's
 *  Háttér (background/cron) bucket carries one today. `missing` (mezo-3u4r fix round 1) carries
 *  `featureLabel(key).missing` through — an undictionaried feature slug must not go on to render
 *  bare in a top list, the same honesty rule `domainTotals`/`featureLegend` already keep via
 *  `AdminLegendEntry`; this is the sibling field for the `topNFromEntries` pipeline. */
export interface AdminVizEntry {
  key: string
  label: string
  value: number
  sub?: string
  missing?: boolean
}

/** Sum a set of per-domain day-series into one totals-per-day array (AdminOverviewPage's
 *  "Logolt sorok · 30 nap" tile: several domains' `days[]`, same length, summed index-by-index). */
export function sumSeriesByDay(series: { days: { count: number }[] }[]): number[] {
  if (series.length === 0) return []
  const n = series[0].days.length
  return Array.from({ length: n }, (_, i) => series.reduce((sum, s) => sum + (s.days[i]?.count ?? 0), 0))
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
 *  value, scaled 0.22–1.0 against the strip's own max, a flat neutral tint at zero. */
export function heatColor(v: number, max: number): string {
  if (!v) return 'rgba(43,33,24,.07)'
  const t = 0.22 + 0.78 * (v / max)
  return `rgba(216,72,31,${t.toFixed(2)})`
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
    return matrix.features.map((feature) => {
      const lbl = featureLabel(feature)
      return {
        key: feature,
        label: lbl.label,
        missing: lbl.missing,
        value: matrix.cells
          .filter((c) => c.feature === feature)
          .reduce((sum, c) => sum + c.costUsd, 0),
      }
    })
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
    missing: e.missing,
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

/** Non-owner users quiet for at least `minDays`, quietest first, capped at `maxRows` (final
 *  review F5 — like the two cost top-lists, this list is uncapped otherwise; the tile's own
 *  "Minden tesztelő aktivitása →" link already covers the rest) — the Pulzus "Csendes tesztelők"
 *  tile (mezo-m079 Task 3). A user who has NEVER been active (`lastActivityAt: null`) is the
 *  quietest of all, sorted first, but gets an honest "még nem aktív" row instead of an invented
 *  day count. `now` is injectable so a test never depends on the real clock.
 *
 *  Fix round 1: these rows carry NO `share` — a day count is not a share of anything, and the
 *  mockup's quiet-testers tile has no bars at all (name left, day count right, in warning
 *  color). `tone: 'warn'` marks a real quiet-day count; `tone: 'mut'` keeps the honest
 *  "még nem aktív" row visually muted rather than alarming. */
export function quietTesters(
  users: Pick<AdminUserInsightResponse, 'id' | 'name' | 'role' | 'lastActivityAt'>[],
  now: Date = new Date(),
  minDays = 3,
  maxRows = 5,
): TopRow[] {
  const withDays = users
    .filter((u) => u.role !== 'OWNER')
    .map((u) => ({
      u,
      days: u.lastActivityAt == null ? null : Math.floor((now.getTime() - new Date(u.lastActivityAt).getTime()) / 86_400_000),
    }))
    .filter((x) => x.days === null || x.days >= minDays)
    .sort((a, b) => (b.days ?? Number.POSITIVE_INFINITY) - (a.days ?? Number.POSITIVE_INFINITY))
    .slice(0, maxRows)

  return withDays.map(({ u, days }) => ({
    key: u.id,
    label: u.name,
    value: days === null ? 'még nem aktív' : `${days} napja`,
    tone: days === null ? 'mut' as const : 'warn' as const,
    to: `/admin/users/${u.id}`,
  }))
}

/** Hungarian copy for the "Költés ma" Δ chip (mezo-m079 Task 3 fix round 1) — a bare "-46%" chip
 *  read as meaningless in the browser check; the mockup's chip carries the comparison in words.
 *  `fromZero` (no trailing history to compare against) reads as "új költés", never a fake 0%. */
export function costDeltaCopy(delta: { pct: number; direction: 'up' | 'down' | 'flat'; fromZero: boolean }): string {
  if (delta.fromZero) return 'új költés'
  const pct = Math.abs(Math.round(delta.pct))
  if (delta.direction === 'flat') return '– megegyezik a heti átlaggal'
  const glyph = delta.direction === 'up' ? '▲' : '▼'
  const word = delta.direction === 'up' ? 'több' : 'kevesebb'
  return `${glyph} ${pct}%-kal ${word} a heti átlagnál`
}

/** Tester status bucket (mezo-zde2 Rulings) — the Emberek list's summary strip + cards' single
 *  source of truth. Boundaries: aktív ≤2 days since last activity, csendesedik 3–6 days,
 *  lemorzsolódott 7+ days, meg_nem_aktiv when `lastActivityAt` is null (never active — no
 *  invented day count). `now` is injectable so callers/tests never depend on the real clock.
 *  Deliberately NOT wired into the Pulzus "Csendes tesztelők" tile (`quietTesters` above) — that
 *  tile keeps its own 3-day threshold per the plan Rulings; this is a second, sibling threshold
 *  for a different UI, not a replacement. */
export type TesterStatus = 'aktiv' | 'csendesedik' | 'lemorzsolodott' | 'meg_nem_aktiv'

/** First/last active day, in "days ago" form, across a user's per-domain activity series
 *  (AdminUserDetailPage's Aktivitás tab, mezo-zde2 Task 3) — reuses `sumSeriesByDay` rather than
 *  re-summing, so this always agrees with what the per-domain heat strips visually show. `null`
 *  for both when the user was never active a single day in the window (honest — no invented day
 *  count), matching the `quietTesters`/`TesterCard` "még nem aktív" precedent. Index-based, not
 *  date-based, so unlike the other helpers in this file it needs no injectable clock. */
export function firstLastActivity(
  series: { days: { count: number }[] }[],
): { firstDaysAgo: number | null; lastDaysAgo: number | null } {
  const totals = sumSeriesByDay(series)
  if (totals.length === 0) return { firstDaysAgo: null, lastDaysAgo: null }
  const activeIdx: number[] = []
  totals.forEach((v, i) => { if (v > 0) activeIdx.push(i) })
  if (activeIdx.length === 0) return { firstDaysAgo: null, lastDaysAgo: null }
  const n = totals.length
  return {
    firstDaysAgo: n - 1 - activeIdx[0],
    lastDaysAgo: n - 1 - activeIdx[activeIdx.length - 1],
  }
}

export function testerStatus(lastActivityAt: string | null, now: Date = new Date()): TesterStatus {
  if (lastActivityAt === null) return 'meg_nem_aktiv'
  const days = Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / 86_400_000)
  if (days <= 2) return 'aktiv'
  if (days < 7) return 'csendesedik'
  return 'lemorzsolodott'
}

/** Client-side mirror of `AdminAlertService.costSpike`'s per-day rule (mezo-pfdv Task 2) — the
 *  Költés trend tile's coral anomaly dots. `series` is a plain chronological `{day, usd}[]`
 *  (the same order as `overview.costSeries`); each entry is evaluated as if it were "yesterday":
 *  it fires when its own `usd` clears the absolute `minUsd` floor AND either the prior-7-day
 *  average is exactly zero (first real spend after a quiet stretch) or the entry's `usd` is
 *  STRICTLY greater than `factor` times that average — matching the backend's `>` (not `>=`),
 *  so a day at EXACTLY 2x the average does not fire. A day with fewer than 7 prior entries in
 *  the series (near its start) is NOT given a shorter window — the missing days count as 0,
 *  exactly like the backend's `costByDay.getOrDefault(day, ZERO)` over the fixed 8-day lookback.
 *
 *  <p>L2 (fix round 3): the `factor`/`minUsd` DEFAULTS here (2 / 0.5) are a client-side COPY of
 *  the backend's tunable `mezo.admin.alerts.cost-spike-factor` / `cost-spike-min-usd`
 *  (`AdminProperties.Alerts`, application.yml) — there is no shared source of truth between the
 *  two. If an operator retunes those knobs without also updating the default arguments below (or
 *  the call site passing an explicit override), the trend's coral dots silently drift out of
 *  sync with the Pulzus `cost_spike` alert they are meant to visually match. */
export function spikeDays(
  series: { day: string; usd: number }[],
  factor = 2,
  minUsd = 0.5,
): string[] {
  const fired: string[] = []
  for (let i = 0; i < series.length; i++) {
    const usd = series[i].usd
    let priorSum = 0
    for (let back = 1; back <= 7; back++) {
      const j = i - back
      if (j >= 0) priorSum += series[j].usd
    }
    const priorAvg = priorSum / 7
    if (usd >= minUsd && (priorAvg === 0 || usd > factor * priorAvg)) {
      fired.push(series[i].day)
    }
  }
  return fired
}

/** Month-end run-rate (mezo-pfdv Task 2 Rulings) — "Várható hó végén, a mostani tempóval":
 *  the calendar-month cost so far, projected linearly across the full month by its elapsed
 *  days. Guards `dayOfMonth <= 0` to 0 rather than dividing by zero (an impossible calendar
 *  day, but a defensive guard costs nothing here). */
export function monthRunRate(monthUsd: number, dayOfMonth: number, daysInMonth: number): number {
  if (dayOfMonth <= 0) return 0
  return (monthUsd / dayOfMonth) * daysInMonth
}

/** Value-score heuristic v1 (mezo-kxnn Task 2, plan Rulings) — the Funkciók scorecard's default
 *  sort AND the value/cost quadrant's x-axis. `uniqueUsers × (1 + habitUserShare)` is the reach ×
 *  stickiness base; `helped` then nudges it by feedback sentiment: `null` (no feedback source —
 *  companion off or the feature is unmapped) is deliberately NEUTRAL (×1, never a penalty for a
 *  feature that simply isn't measured yet), a real `{up, down}` scales between ×0.5 (all-down)
 *  and ×1.5 (all-up) via `0.5 + up/(up+down)`. `up + down === 0` (an object present but empty —
 *  not the same as `null`) also reads as neutral rather than dividing by zero. This is explicitly
 *  a v1 heuristic, not a scored/blessed metric — documented here rather than hidden in a page. */
export function valueScore(row: Pick<AdminFeatureRow, 'uniqueUsers' | 'habitUserShare' | 'helped'>): number {
  const helped = row.helped
  const helpedFactor = helped === null || helped.up + helped.down === 0
    ? 1
    : 0.5 + helped.up / (helped.up + helped.down)
  return row.uniqueUsers * (1 + row.habitUserShare) * helpedFactor
}
