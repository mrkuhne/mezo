# D′ — Insights Weekly real (deterministic v0) + honest surface — Design

- **Date:** 2026-07-05
- **bd:** `mezo-t16y.1` (epic `mezo-t16y`)
- **Roadmap brief:** `docs/superpowers/plans/2026-07-04-phase2-completion-roadmap.md` §D′
- **Feature doc of record:** `docs/features/insights.md`
- **Status:** approved (4 open decisions settled with Daniel, 2026-07-05)

## 1. Goal

The Insights tab stops lying in real mode:

- **Weekly** becomes a real, deterministic weekly review composed from the user's own data
  (fuel rollups, sleep log, weight EWMA, Train done-vs-planned) with real trend arrows.
- **Memoir / Predictions / Experiments** stop rendering hand-authored fiction in real mode.
- **`weeklySuggestion` prose** gets an honest placeholder (the real prose is proactive-epic work).

Mock mode keeps the full Phase-1 demo everywhere (7 tabs, seed copy, byte-parity).

## 2. Decisions (settled 2026-07-05)

| # | Decision | Choice |
|---|---|---|
| 1 | Backend read-model vs client composition | **Client-side composition** (the `buildDayPlan`/T-slice precedent) over existing reads, **plus one small Train list read** (D3) — no `api/feature/insights` fragment, no insights backend. |
| 2 | Score `/100` | **Documented deterministic formula with a „tanulom" gate**: no data → the patterns-precedent null-state, never a fabricated number. |
| 3 | Missing last-week gym count | **Add `GET /api/train/workouts?from&to`** (light summary list) — contract-first, small controller/service/repo addition + ITs. |
| 4 | Memoir/Predictions/Experiments in real mode | **Hide the sub-tabs** (real mode shows 4 tabs); direct URLs render a one-line honest ghost card. Mock keeps 7 tabs. |
| 5 | Week boundary | **Current Monday-based week, week-to-date**, compared against the full previous week. Consistent with F-P4's `mondayIso()` and reuses `GET /api/fuel/week/{start}`. |

## 3. Architecture

### 3.1 New hook — `data/insights/weeklyHooks.ts` (`useWeekly()`)

Re-exported from the `@/data/hooks` barrel; `WeeklyPage` switches to it. Shape:

```ts
interface WeeklyView {
  weekly: {
    title: string            // mock: seed · real: 'Hét {ISO} áttekintés · {Júl 1 – 7}' (deriveWeekTitle)
    score: number | null     // null ⇒ „tanulom" null-state
    delta: number | null     // null when score null or last week has no data
    items: WeeklyItem[]      // {label, value, trend} — existing type
  }
  deltaLabel: string          // mock: 'vs hét 20' · real: 'vs előző hét'
  weeklySuggestion: string | null  // mock: seed prose · real: null ⇒ honest placeholder card
  mode: 'mock' | 'real'
}
```

Mock mode returns the seed verbatim (byte-parity — the existing `WeeklyPage` render is pinned by
tests). Real mode composes from **unconditionally-called** hooks/queries (rules-of-hooks idiom from
`fuelWeekHooks.ts`):

| Source | Query | Serves |
|---|---|---|
| `mealApi.getWeek(mondayIso())` | `['fuelWeek', start]` (shared with F-P4) | kcal pacing, protein-hit days (this week) |
| `mealApi.getWeek(prevMonday)` | `['fuelWeek', prevStart]` | same, last week (trends) |
| `useSleep().sleepLog` | `['sleepLog']` | sleep avg h + quality, both weeks (client filter by date) |
| `useWeight().weightTrends` | `['weightTrend']` | EWMA weekly rate (kg/hét) |
| `useTrain().gymDoneDates` + `gymSchedule` | existing | gym done/planned, this week |
| `useTrain().sport` (sessions + schedule) | existing | volleyball done/planned, both weeks |
| **new** `trainApi.listWorkouts(from, to)` | `['train','workouts',from,to]` | gym done count, last week |

All rollup logic lives in **exported pure functions** (the `deriveWeeklyStats` precedent) so it is
unit-testable without rendering.

### 3.2 Metric rows (real mode, in this order)

| Row | Value | Trend (vs full previous week) |
|---|---|---|
| `Edzés` | `{done}/{planned}` (gym done = `weekDoneDates`, planned = active gym-schedule days + volleyball schedule; volleyball done from sport sessions) | done-count this week vs last week (new endpoint + sport list) |
| `Alvás átlag` | `{avg}h · min {qAvg}` over this week's entries | duration avg vs last week |
| `Kcal pacing` | `{round(factor×100)}% target` (F-P4 `deriveWeeklyStats` semantics: avg over logged days) | factor closeness vs last week |
| `Fehérje-napok` | `{hit}/7` | hit-days vs last week |
| `Súly trend` | `{±rate} kg/hét` (EWMA `last7d.weeklyRate`) | **goal-ward mapping** (single-user cut): rate ≤ −0.1 → `up` (green), −0.1..+0.1 → `flat`, > +0.1 → `down`. Constant documented in code. |

A row whose source has no data renders `value: '—'`, `trend: 'flat'` (honest em-dash — the T-slice
QuickStats precedent). Trend ties (equal values / no last-week data) → `flat`.

### 3.3 Score formula (deterministic v0)

`score = round(100 × mean(available sub-scores))`, equal weights, documented as FE constants in
`weeklyHooks.ts` (promotable to backend config later — noted in the feature doc):

- **kcal** = `max(0, 1 − |factor − 1| / 0.25)` — closeness to target within a ±25% linear band
  (over-eating is not rewarded).
- **protein** = `hitDays / 7`.
- **sleep** = `min(1, avgH / 8)` — `SLEEP_TARGET_H = 8` documented constant.
- **train** = `min(1, done / planned)` — skipped when `planned === 0`.
- **weight is excluded** — its goodness is goal-direction-dependent; it stays a trend-only row.

A sub-score whose source has no data this week is **skipped** (mean over the rest). **Zero
available sub-scores → `score: null`** → the page renders the patterns-precedent „tanulom"
null-state instead of the big number. `delta` = this-week score − last-week score (same formula
over last week's data); `null` when either side is null.

### 3.4 New Train read — `GET /api/train/workouts?from={date}&to={date}`

Contract-first in `api/feature/train/train.yml`:

- `operationId: listWorkouts`, tag `Train`, required `from`/`to` query params (ISO dates,
  inclusive), 400 on missing/invalid or `from > to`.
- Response: `WorkoutSummaryResponse[]` — **new light schema** `{ id: uuid, date: string (date),
  status: string }`. No sets, no exercises (the instance body stays on the existing endpoints).
- Backend: `feature/train` controller method + service (ownership-filtered derived/JPQL query on
  the existing workout-instance table, date range, soft-delete respected) + MapStruct mapping.
- ITs (`ApiIntegrationTest`): range filtering, empty range, ownership isolation (existing workout
  populator), validation error shape.

### 3.5 Honest surface — tabs + placeholders

- **`tabs.ts`**: `INSIGHTS_TABS` stays the full 7 (mock); export `visibleInsightsTabs()` that
  filters out `memoir`/`predictions`/`experiments` when `!isMockMode()`. `InsightsSubNav` renders
  the filtered list. (`InsightsSection`'s title derivation keeps working — it derives from
  pathname, not the tab list.)
- **Routes stay mounted** (no router change): in real mode `MemoirPage` / `PredictionsPage` /
  `ExperimentsPage` render a one-line ghost card instead of the demo content —
  „A memoir a proaktív réteggel érkezik · hamarosan" (analóg copy a másik kettőre). Direct URLs
  therefore never show fiction.
- **`WeeklyPage` suggestion card**: `weeklySuggestion === null` (real) → the card renders
  „A társ heti tervjavaslata hamarosan." and **no** inert `Elfogad`/`Hangoljuk` buttons; mock
  renders the seed + buttons unchanged.

## 4. Out of scope (unchanged from the roadmap)

Memoir generation, predictions engine, N=1 experiments domain, knowledge `edges` graph, any LLM
prose (all proactive-epic / later); `useInsights`'s remaining static exports stay clearly-labelled
mock (patterns already real via `usePatterns`).

## 5. Testing

- **BE:** `./mvnw clean test` — new listWorkouts ITs (§3.4).
- **FE:** pure-function unit tests for week filtering, row derivation, score/delta (incl. the
  tanulom gate and skipped sub-scores); `weeklyHooks` dual-mode tests (mock seed parity + real
  composition, `fuelWeekHooks.test.tsx` idiom); `WeeklyPage` both modes (seed render pinned in
  mock; „tanulom" + placeholder card in real-empty); `InsightsSubNav`/nav tests for the 4-vs-7 tab
  split; ghost-card tests for the three hidden pages in real mode.
- **Gates:** `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` + backend suite green.

## 6. Docs

`docs/features/insights.md` (§1 status, §2.2/2.3/2.6/2.7, §3 data flow, §4 endpoints, §9
decisions, §10 key files) + `docs/features/train.md` §4 (new endpoint) +
`docs/milestones/roadmap.md` milestone row; `node scripts/lint-docs.mjs` clean.
