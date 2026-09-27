# „Hogy tanultam?” — learned-base explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A "Hogy tanultam?" toggle in the learned Alap section of the Fuel energy sheet that
expands a six-part explanation of how the learned base was computed, from real per-user data.

**Architecture:** The weekly learning run (`ExpenditureLearningService.reviewWeek`) already
replays the window through `ExpenditureFilter`. It additionally builds an
`ExpenditureExplanationJson` (aggregates + a 56-day chart series from the filter trace) and
persists it as `expenditure_estimate.explanation` (jsonb). A read-only endpoint serves the latest
row + explanation. The FE fetches it lazily when the toggle opens and renders the approved
prototype.

**Design source (owner-approved 2026-09-27):** `docs/design_2.0/prototypes/hogy-tanultam.html`.
Copy, section order, icons, chart encoding and motion come from it verbatim.

**bd:** `mezo-y72o3` (follow-up of `mezo-zz91i`).

## Global Constraints

- No filter work on the request path: the explanation is computed in the weekly run and persisted.
- Honest data: every number shown comes from the persisted explanation; nothing is invented. A field
  that is missing hides its line (no fallbacks like 0 or 'medium').
- Üveg canon: the sheet is the only glass; the explainer is flat cells (rank 3), Titanium 3D sprite
  icons (`Icon3D`), no emojis, no new colors beyond the `--dv-*` tokens, one-shot rAF chart
  draw-in with a reduced-motion branch.
- Contract order: `api/feature/goal/goal.yml` → `cd api/generate && npm run generate:api` →
  `cd frontend && pnpm generate:api`.
- Liquibase in `backend/src/main/resources/db/changelog/1.1.0/` (id
  `"1.1.0:{YYYYMMDDHHMM}_mezo-y72o3_{desc}"`), additive nullable column.
- Every tunable in `GoalEngineProperties.Expenditure` + `application.yml` (e.g. the water-event
  threshold); no `@Value`.
- Backend ITs with `-Dmezo.test.use-testcontainers=true`; FE tests in both modes
  (`CI=true pnpm test`, `CI=true VITE_USE_MOCK=false pnpm test`) + `pnpm build`; CODEMAP regenerated.
- Commits `feat(goal|fuel): … (mezo-y72o3)` ending with the `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` trailer.

---

### Task 1: Backend — filter trace + explanation built and persisted

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureFilter.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/ExpenditureExplanationJson.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ExpenditureExplainer.java` (pure)
- Modify: `ExpenditureLearningService.java`, `ExpenditureEstimateEntity.java`, `GoalEngineProperties.Expenditure` (+ yml + all construction sites), Liquibase script + master entry
- Modify: `ExpenditureRolloutRunner.java` (backfill: users whose latest row has `explanation == null` get that same week re-reviewed — idempotent upsert)
- Tests: `ExpenditureFilterTest` (trace), `ExpenditureExplainerTest` (pure), `ExpenditureLearningServiceIT` (explanation persisted), `ExpenditureRolloutRunnerIT` (backfill)

**Interfaces (produced):**
- `ExpenditureFilter.runWithTrace(List<Day>, double prior, Params) → Optional<Traced>` where
  `record Traced(Estimate estimate, List<DayTrace> days)` and
  `record DayTrace(LocalDate date, double tissueKg, double waterKg, double glycogenKg)` — one per day from the
  first weigh-in on; `run(...)` delegates to it (same numbers).
- `ExpenditureExplanationJson(LocalDate windowStart, LocalDate windowEnd, int usableDays, int weighInDays,
  int unloggedDays, int historyWeeks, Integer avgIntakeKcal, int avgMovementKcal,
  BigDecimal tissueRateKgPerWeek, Integer tissueKcalPerDay, Integer simpleBaseKcal, int startBaseKcal,
  List<ExcludedIntakeDayJson> excludedDays, List<WaterEvent> waterEvents, List<SeriesPoint> series)`
  with `record WaterEvent(LocalDate date, BigDecimal kg)` and
  `record SeriesPoint(LocalDate date, Integer intakeKcal, String status /* usable|suspicious|marked|unlogged */,
  BigDecimal weightKg, BigDecimal trendKg, BigDecimal tissueKg)`.
- `ExpenditureExplainer.explain(...)` (pure) computes it:
  - counts over the whole window (usable / weigh-in days / unlogged; historyWeeks = ceil(days since first weigh-in in window / 7));
  - `avgIntakeKcal` = mean usable intake; `avgMovementKcal` = mean movement input over the window;
  - `tissueRateKgPerWeek` = (tissue at window end − tissue at trace start) / days × 7 from the trace; `tissueKcalPerDay` = rate/7 × kcalPerKg;
  - `simpleBaseKcal` = avgIntake − tissueKcalPerDay − avgMovement (null when no usable day);
  - `startBaseKcal` = the prevApplied used for this week's step;
  - `excludedDays` = SUSPICIOUS/MARKED days in the whole window (date-asc);
  - `waterEvents` = days where glycogenKg − glycogenKg 7 days earlier ≥ `water-event-kg` (config, 0.8), collapsed so consecutive days report once (first date, the max jump);
  - `series` = the last 56 days of the window: intake + status, the day's mean weight, `trendKg = tissue + water + glycogen`, `tissueKg`.
- Entity: `explanation` jsonb (nullable) with getter/setter.

- [ ] TDD each unit; IT asserts the persisted explanation for the existing fixtures (excluded day listed, counts, series length 56, simpleBase within ±250 of the posterior).
- [ ] Commit.

### Task 2: API — GET /api/goals/expenditure/explanation

**Files:** `api/feature/goal/goal.yml` (+ regenerate both), goal controller (find the controller serving `/api/goals`), mapper, `…/feature/goal/controller/…IT`.

**Contract:** `GET /api/goals/expenditure/explanation` → `200 ExpenditureExplanationResponse` for the caller's latest
`expenditure_estimate` row that has an explanation, `204` when none. Response: `weekStart, status, confidence
(low|medium|high), formulaBaseKcal, posteriorBaseKcal, posteriorSdKcal, appliedBaseKcal, stepKcal` + every
explanation field (series points with nullable numbers). Owner-scoped (created_by = caller) like every goal read.

- [ ] Contract-first, IT (200 with fields, 204 without a row, another user's row never visible), commit.

### Task 3: Frontend — the explainer

**Files:**
- Create: `frontend/src/data/fuel/expenditureHooks.ts` (dual-mode `useExpenditureExplanation(enabled)` via `isMockMode()`, the repo's react-query/fetch idiom — copy from a sibling hook such as `frontend/src/data/me/goalHooks.ts`)
- Create: mock fixture (the prototype's numbers: 47 usable, 52 weigh-ins, 8 weeks, 2780/−352/−426 ≈ 2000, four suspicious days 604/929/828/1347 on 09-13/19/20/24, one water event 09-14 +1.5 kg, 9 unlogged, sd 200 LOW, 2356 → 2309 → −150 → 2159, a 56-point series) and MSW handler for real-mode tests
- Create: `frontend/src/features/fuel/sheets/LearnedBaseExplainer.tsx` (+ test)
- Modify: `EnergyBreakdownSheet.tsx` (the "Hogy tanultam?" toggle under the learned base's `flp-ewhy`, `aria-expanded`/`aria-controls`, renders the explainer only on the learned path), `frontend/src/styles/prototype.css` (port the prototype's `.how-*`, `.cell`, `.stats`, `.calc`, `.chips`, `.meter`, `.steps` rules under an `flp-how` prefix, tokens only)
- The chart: an inline SVG ported from the prototype's `drawChart` as a React component (bars usable = sage, suspicious/marked = rose hatch, unlogged = none; weigh-in dots; trend line = sky with glow; water band between trend and tissue = lav); one-shot rAF draw-in on first open; reduced motion renders the final frame.

**Rules:** a section whose data is missing is hidden (e.g. no `simpleBaseKcal` → no section 3). The "Miért {applied} és nem {simple}?" note shows only when they differ by ≥ 30 kcal. Meter position from sd: `clamp((300 − sd) / 200, 0, 1)`. Confidence copy per the prototype (low „Még tanulok”, medium „Közepesen biztos”, high „Biztos”). Step chain: formula → start (label „a korábbi igazításaiddal” only when start ≠ formula) → step (coral when negative, sage when positive, hidden when 0) → now.

- [ ] Tests: toggle opens/closes (aria-expanded), sections render real fixture numbers, hidden-when-missing cases, reduced-motion path; both modes; build; commit.

### Task 4: Docs + gates

- [ ] `docs/features/fuel.md` + `docs/features/goal-engine.md` (explainer, endpoint, explanation jsonb); CODEMAP; README of prototypes (add `hogy-tanultam.html`); full FE both modes + build; backend focused suite for goal/fuel; commit.
