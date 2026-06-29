# Súly oldal (WeightView) újratervezés — Design Spec

**Date:** 2026-06-29
**Driving bd:** `mezo-l82h`
**Scope:** **Frontend-only.** No backend, no API contract, no hook-signature change. Both modes (mock + real) stay green.
**Boundary:** reads the existing `useWeight()` (`weightLog`, `weightTrends`) and `useGoal()` (`goal`, **`goalResponse`**) — nothing new crosses `src/data/hooks.ts`.
**Status:** approved design (brainstormed with browser mockups 2026-06-29 — chart variant **B**, week pagination **A**) → ready for implementation plan

---

## 1. Goal & Scope

The `Me · Súly` page (`WeightView`) today shows a tiny 140px trend chart + two trend cells — **very little info**. Redesign it into a richer, mobile-first weight history page in mezo's own dark/teal language, composed of three blocks:

1. **Hero** — how much you've lost from the start + the key stats at a glance.
2. **Big trend chart** — the logged weight as a beautiful curve with day/kg axes, a smoothed trend line, **plus the plan trajectory and a tolerance band** (chart variant **B**), with a `7d/30d/90d/1y` window toggle.
3. **Weekly history** — per-ISO-week aggregate cards (avg, weekly delta, low, sparkline, direction), each **expandable to a per-day breakdown** (day · weight · day-over-day delta), browsable backwards via a **"Régebbi hetek" load-more** button.

**In scope:**
- New presentational components under `features/me/components/`: `WeightHero`, `WeightTrendChart` (variant B), `WeeklyWeightCard`.
- A new **pure helper module** `weightStats.ts` (+ unit tests) holding all derivations (ISO-week grouping, weekly aggregate, progress %, ETA, period slicing, moving average, plan-trajectory points).
- Rewire `WeightView.tsx` to compose the three blocks.
- Retire the old `WeightChart` usage and the `TrendCell` row from `WeightView` (the real trend figures move into the hero).
- Update `docs/features/me.md` (Súly section) and `WeightView.test.tsx`.

**Out of scope (YAGNI):**
- Any backend / contract / `useWeight` / `useGoal` signature change. The backend already exposes an EWMA `ewmaSeries`, but we do **not** plumb it through — the smoothed line is computed FE-side from `weightLog` (works identically in both modes, no hook change).
- A weight-vs-plan chart in `GoalsView` — confirmed there is **no** existing one to reuse/duplicate; this is net-new and lives only here.
- Editing/deleting past logs, date-picker backfill — the log CTA (today-only) is unchanged.
- The Today/Trend/Plan tab bar from the inspiration screenshot — single scrolling page (matches the current view + the other screenshots).

---

## 2. Data available (the boundary — unchanged)

From `useWeight()`:
- `weightLog: WeightEntry[]` — `{ date: 'YYYY-MM-DD', value: number, note?: string }`, ascending, **sparse** (not every day). Mock spans 15 entries Ápr 22 (81.4) → Máj 22 (78.6).
- `weightTrends: { last7d: {avg, weeklyRate}, last4w: {weeklyRate} }` — backend EWMA figures (real) / static (mock). Real-mode unresolved = ZERO trend.
- `logWeight(input)` — unchanged; the hero CTA still opens `WeightLogSheet`.

From `useGoal()`:
- `goal: Goal | null` — `startWeight`, `currentWeight`, `targetWeight`, `rateTarget {value, unit:'%/hét', direction}`. **`null` in real mode when no goal is set.**
- `goalResponse: GoalResponse | null` — the raw contract, also exposed in mock + real. Carries `startDate`, `targetDate`, `startWeightKg`, `targetWeightKg?`, `rateTargetPctPerWeek`, `trajectory ('cut'|'bulk'|'maintain')`. **This is the source for the plan trajectory.**

**Graceful degradation is a first-class requirement:** every derived figure must have a defined behavior when `goal`/`goalResponse` is `null` or `weightLog` is short. See §6.

---

## 3. Derivations — `weightStats.ts` (pure, unit-tested)

A new pure module (co-located with components, mirroring `radarGeometry.ts`). No React, no I/O. All functions total (defined for empty/short input).

```
type Dir = 'down' | 'up' | 'flat'

// latest logged value, or null if no logs
latestValue(log): number | null

// "down from start": start − latest (positive = lost). start = goal.startWeight ?? log[0].value
deltaFromStart(log, startWeight): number | null

// progress toward target, clamped 0..100; null unless a target exists & start≠target.
//   cut  (target<start): (start − latest)/(start − target)
//   bulk (target>start): (latest − start)/(target − start)
progressPct(start, latest, target): number | null

// weeks to target at the current weekly rate; null unless rate moves toward target.
//   remaining = latest − target ; perWeek = −weeklyRate (loss is +)
//   valid only when sign(remaining) === sign(perWeek) and perWeek≠0 ; round, min 1
etaWeeks(latest, target, weeklyRate): number | null

// trailing simple moving average over `win` points (default 3) — the smoothed line
movingAverage(values, win=3): number[]

// slice log to a date window ending at the last entry's date (or today):
//   '7d'→7, '30d'→30, '90d'→90, '1y'→365 days back, inclusive
sliceByPeriod(log, period): WeightEntry[]

// ISO weeks (Mon–Sun). Newest first. Each:
//   { startIso, endIso, entries[], avg, low, count, delta, direction, sparkPoints[] }
//   avg   = mean(values)            low = min(values)
//   delta = avg − previousWeek.avg  (null for the oldest week)  → pill, colored
//   direction = sign(lastEntry − firstEntry) within the week → down/up/flat
groupByWeek(log): WeekAggregate[]

// per-day rows for an expanded week, newest first:
//   { iso, value, dod }  where dod = value − previousEntryValue ACROSS THE WHOLE LOG
//   (so a week's first day compares to the prior week's last entry; null only for the very first log)
dayRows(log, week): DayRow[]

// plan trajectory sample points within a visible date window, from goalResponse.
//   linear from (startDate, startWeightKg) → (targetDate, targetWeightKg).
//   returns null when goalResponse is null OR targetWeightKg == null (→ chart hides plan+band).
//   band = plan ± TOLERANCE_KG (const, default 1.0)
planTrajectory(goalResponse, windowStartIso, windowEndIso): { plan:[{iso,kg}], tolKg } | null
```

`TOLERANCE_KG = 1.0` is a module const (documented as the on-track tolerance; tunable). Weekly delta uses **avg-to-avg**; the per-day delta uses **consecutive-entry** difference.

---

## 4. Components

### 4a. `WeightHero` (`components/WeightHero.tsx`)
Props: `{ log, weightTrends, goal }`. Renders:
- Eyebrow `Induláshoz képest`; big display number `deltaFromStart` signed (`−2.8`), `kg` unit, glow text-shadow (brand-glow).
- Subline `{start} → {latest} · cél {target} kg` (the `· cél …` part only when a target exists).
- Progress pill `✓ {progressPct}% a célig` (good color) — only when `progressPct !== null`.
- Stat row (3 `notch-4` cards): **Jelenleg** `{latest}`, **7-nap/hét** `{last7d.weeklyRate}` (signed, good/bad color), **ETA** `{etaWeeks}h` (or `—`).
- Micro caption `4-hét tempó {last4w.weeklyRate} kg/hét` (preserves the engine's 4-week figure that the old TrendCell showed).
- `＋ Súly naplózása` CTA → `onLog()`.

### 4b. `WeightTrendChart` (`components/WeightTrendChart.tsx`) — variant B
Props: `{ log, goalResponse, period }` (period state owned by `WeightView`). SVG, responsive viewBox. Renders, back-to-front:
1. Y gridlines + ~3 kg tick labels; X ~3 date labels (`huMonthDay`).
2. **Tolerance band** (gold faint fill) + **plan trajectory** (gold dashed) — only when `planTrajectory(...) !== null`.
3. Actual **area** (brand-glow gradient) + faint raw line + **bold smoothed glow line** (`movingAverage`).
4. Latest dot + value label.
- **Y auto-scales** to the union of {visible actual points} ∪ {visible plan+band segment} (+0.5 kg pad) so the curve reads well and the plan stays on-screen. (Not anchored to target like the old chart.)
- Window via `sliceByPeriod`. `< 2` visible points → soft centered hint `Kevés mérés ehhez az ablakhoz`. No `goalResponse`/target → actual-only (band+plan omitted) — same component, graceful.

### 4c. `WeeklyWeightCard` (`components/WeeklyWeightCard.tsx`)
Props: `{ week, dayRows, expanded, onToggle }`. Collapsed: range label (`huMonthDay(start)–huMonthDay(end)` compacted), delta pill (good/bad), `{avg} kg átlag · {count} bejegyzés · min {low}`, mini sparkline (`sparkPoints`), `H K Sz Cs P Sz V` legend + direction (`↓ lefelé / ↑ felfelé / → stabil`). Expanded (button, `aria-expanded`): the per-day rows (`huMonthDayDow` · `{value} kg` · signed `dod` colored), newest first. Whole header is the toggle.

### 4d. `WeightView` (rewire)
```
useWeight() → log, weightTrends, logWeight ; useGoal() → goal, goalResponse
period state ('30d' default) ; expandedWeek state (iso | null, default = newest) ; visibleWeeks state (6)
─ page-header (Eyebrow + PageTitle, unchanged)
─ <WeightHero …/>
─ Súly · trend  + period chips (7d/30d/90d/1y)  → <WeightTrendChart …/>
─ Heti előzmény  → groupByWeek(log).slice(0, visibleWeeks).map(<WeeklyWeightCard/>)
                  + "Régebbi hetek ▾" (visibleWeeks += 6) while more remain
─ WeightLogSheet (unchanged trigger)
```
`latest` fallback chain stays: `log.at(-1)?.value ?? goal?.currentWeight ?? 0`.

---

## 5. Data flow

`WeightView` is the only stateful node (period, expandedWeek, visibleWeeks, logOpen). It calls the two hooks, runs `weightStats` selectors, and passes plain data down to the three pure presentational components. No new context, no new query keys, no prop drilling beyond one level. Logging a weight invalidates `['weightLog']`/`['weightTrend']` (existing mutation) → the hero/chart/weeks recompute on the next render. Identical wiring in mock and real mode.

---

## 6. Edge cases & error handling

| Condition | Behavior |
|---|---|
| `weightLog` empty | Hero big number `—`, no pill/ETA; chart shows the hint; no week cards (just the section header). |
| `weightLog` 1 entry | Hero shows `Jelenleg` only (delta/pill/ETA null → `—`); chart hint; one week card, no within-week delta. |
| `goal === null` (real, no goal) | `start = log[0].value` → delta-from-start still works; no target subline/pill/ETA; chart actual-only. |
| `goalResponse === null` or `targetWeightKg == null` | Plan trajectory + band omitted; actual-only curve. |
| Real-mode trend unresolved (ZERO) | `7-nap/hét 0.0`, `4-hét 0.0`, ETA `—` for the brief load window (existing invariant, benign). |
| `weeklyRate` not toward target | ETA `—`. |
| Window with `<2` points (90d/1y on sparse data) | Chart hint; hero/weeks unaffected (they use the full log). |

No throw paths; all selectors are total. No network/error states beyond what the hooks already own.

---

## 7. Testing

- **`weightStats.test.ts`** (Vitest, pure): `progressPct` cut & bulk & clamp & null; `etaWeeks` toward/away/zero; `deltaFromStart` with/without goal; `groupByWeek` boundaries (Mon–Sun, newest-first, avg/low/delta/direction) on the mock log; `dayRows` cross-week dod; `planTrajectory` null-paths + linear interpolation; `sliceByPeriod` windows.
- **`WeightView.test.tsx`** (RTL, both modes): mock mode asserts header `Napi súly`, hero `Induláshoz képest`, a stat label (`Jelenleg`), a week range label, the `Régebbi hetek` button appears only when >6 weeks, expanding a week reveals a `huMonthDayDow` day row, and the log CTA opens `WeightLogSheet`. Real-mode test keeps the EWMA assertion: the `7-nap/hét` stat reads the backend weekly rate (`-0.55`).
- **Gates:** `pnpm test` (real default) **and** `VITE_USE_MOCK=true pnpm test`; `pnpm build`; `pnpm parity` screenshot refresh for the Súly route.

---

## 8. File map

**New:** `components/weightStats.ts`, `components/weightStats.test.ts`, `components/WeightHero.tsx`, `components/WeightTrendChart.tsx`, `components/WeeklyWeightCard.tsx`.
**Modified:** `views/WeightView.tsx`, `views/WeightView.test.tsx`, `docs/features/me.md`.
**Retired (from WeightView):** `components/WeightChart.tsx` + `components/TrendCell.tsx` usages — components deleted (each is used only by `WeightView`; the `weightHooks.ts` "TrendCell" hit is a comment).

---

## 9. Open tunables (defaults chosen, easily changed)

- `TOLERANCE_KG = 1.0` (band half-width).
- Moving-average window `= 3` points.
- Initial `visibleWeeks = 6`, step `+6`.
- Weekly delta = avg-to-avg; per-day delta = consecutive-entry.
- Default period `= '30d'`.
