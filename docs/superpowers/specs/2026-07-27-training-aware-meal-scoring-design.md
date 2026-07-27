# Training-aware role-based meal scoring (deterministic hybrid v1)

- **Date:** 2026-07-27
- **Driving issue:** mezo-ta8p
- **Status:** design approved (implementation pending)
- **Supersedes/extends:** `2026-07-05-fuel-p7-meal-scoring-design.md` (the deterministic v0 engine, ADR 0006 / mezo-yta / mezo-7797)
- **Related:** mezo-mr4n (LLM meal-coach, hybrid step 2 — deferred), mezo-u68c (logged-meal name bug — independent, out of scope here)

## 1. Context & problem

The deterministic `MealScoringService` (`backend/.../feature/nutrition/service/MealScoringService.java`) is **blind to training context**. `scoreMeal(slot, lines, localTime)` (`:73`) receives only the slot, the wall-clock time, and the macro/quality lines — never the fact that a meal was eaten *before or after a workout*.

Consequence, confirmed on the live k3s DB: a real pre-workout breakfast logged at 06:13 (recipe *"PB Banana Toast Pre-workout"*, category `breakfast`) scored **0.48 ("AI 48")**, dragged down by:

| dim | score | weight | reason |
|---|---|---|---|
| `who` | **0.00** | 0.14 | sugar 33% of energy (WHO ≤10%), salt 220% |
| `nova` | **0.20** | 0.18 | dominant NOVA 4, 0% from NOVA 1–2 |
| `macro` | 0.50 | 0.22 | P/C/F 17/71/11 vs 27/47/26 target (too carb-heavy) |
| `context` | 0.54 | 0.12 | timing 74% · kcal-budget 71% · protein 18% |

This is **physically dishonest**: fast carbs (honey / banana / whole-grain toast) immediately before a workout are *good fuel*, not a dietary sin. The generic WHO/NOVA "healthy eating" rubric is the wrong yardstick for a fueling meal. Nutritional quality is **role-dependent**, and the engine currently applies one universal rubric to every meal regardless of its role.

(Separately, the recipe badge shows *"fit 60"* while the logged meal shows *"AI 48"* for the same food. That divergence is **by design** — the recipe/template surface scores `portionDim`, the logged-meal surface scores `contextDim` (`MealScoringService.java:76-79` vs `:120-124`). It is not a bug; it is confusing only because of inconsistent labeling. Out of scope here except that this work makes the logged-meal number *more* honest, not less.)

## 2. Decision summary

Chosen direction (agreed with the owner): **hybrid scoring**, built in two steps.

- **Step 1 — THIS SPEC:** make the *deterministic* score training-aware via a **meal role**. Keeps the number **stable, comparable day-to-day, cheap, reproducible, unit-testable** — a deterministic number should not wobble run-to-run.
- **Step 2 — deferred (mezo-mr4n):** an LLM "coach" layer that adds the *qualitative, context-rich verdict* ("great pre-workout fuel for your Pull Day") on top of the stable baseline. Needs Phase-3 Spring AI infra (not yet built). **Not in this spec.**

Within step 1 (also agreed):

- **Role-based rubric**, not a bolt-on timing multiplier. A meal gets a **role** `standard` / `pre_workout` / `post_workout` from the day's training context; each role selects its own scoring rubric.
- **Scope: pre + post together** (all three roles) in v1.
- **`standard` = today's exact behavior** → **zero regression** on rest-day / off-window meals.
- The role is scored on the **logged-meal surface only** (`scoreMeal`). The **recipe fit / template surface is unchanged** (a recipe has no training context; its badge stays the context-free baseline). This is intentional and actually clarifies the recipe-vs-log story: the recipe badge is a generic estimate, the logged meal reflects your actual situation.

## 3. The role model — derivation (deterministic)

### 3.1 Source of the day's workouts
The authoritative workout clock time is the **weekly recurring schedule slot**, matched by the meal date's day-of-week — the *same source the frontend already uses* to place pre-workout fuel (`frontend/src/data/fuel/timelineHooks.ts:46-63` `deriveBlocks`, reading `gym_schedule_slot` / sport / running-block time). Backend equivalents:

- Gym: `GymScheduleSlotEntity.time` (`feature/train/entity/GymScheduleSlotEntity.java:47`) where `dayOfWeek == mealDate.dayOfWeek` (0=Mon..6=Sun mapping already used in train).
- Sport: `SportSessionEntity.time` for that date (nullable) else `SportScheduleSlotEntity.time`.
- Run: active running block's `RunPrescribedSession.timeOfDay` (nullable) for the current week's day.

A **workout window** is `{ start: LocalTime, end: LocalTime, kind }`.
- `end` for gym (no stored duration): `start + gymDefaultDurationMin` (config, ~75).
- `end` for sport/run: `start + durationMin` when present, else `start + gymDefaultDurationMin`.

### 3.2 Honesty rules on the source (critical)
- The slot time is a **plan/template time, not a proven execution time** — a completed `WorkoutSessionEntity` carries a date but no clock time. `pre_workout` legitimately uses the plan alone (it looks forward; the intended workout is the only signal at log time).
- `post_workout` **requires the workout to have actually happened that day** — combine the schedule slot with the dated completed-instance signal (`WorkoutSessionRepository.findDoneInstanceDates`, sport/run session-by-date). No recovery bonus for a workout you skipped.
- All time sources are **nullable / optional**. No workout that day, or unresolvable time → **`standard`** (never fabricate a role).

> **Implementation note (mezo-tm76, 2026-07-27)** — how the `done` signal is pinned to a *particular* window, settled during the follow-up hardening:
> - **Gym:** a completed instance carries a date but no clock time, so on a multi-slot day it cannot be attributed to one slot. `done` is therefore **coverage-based**: true for every slot only when the day's completed instances **cover all** of that weekday's slots; a partial day leaves them **all** not-done. Deliberately conservative — a missed recovery bonus beats one fabricated on the slot that did not happen.
> - **Sport:** `SportSessionEntity` *does* carry a time, so a logged session **is** the window (its own time + duration, `done = true`) and **consumes the recurring slot nearest to it in time**; slots left unmatched still emit their planned window with `done = false`. A session with neither its own time nor a matchable slot yields **no window** (unresolvable time → `standard`).
> - **Run:** windows stay **pre-only** (`done = false`); the block week is re-derived from `startDate` for the *queried date* (`MesoWeeks.weekOf`), never read off the lagging `running_block.current_week`.

### 3.3 Classification (pure, given windows + logged local time)
For a meal at local time `t` against the day's windows:
- **`pre_workout`** if `t ∈ [start − preLeadMin, start)` for any window.
- **`post_workout`** if `t ∈ [end, end + postTrailMin]` for any window **that was actually done**.
- else **`standard`**.
- **Precedence / multiple workouts:** pick the window nearest in time to `t`; if `t` qualifies as both pre (for a later workout) and post (for an earlier done workout), **post wins when the earlier workout is done** (recovery is the more time-critical need), else pre. Ties → nearest `start`.
- `preLeadMin` should be **reconciled with the FE pre-workout fuel anchor** so the timeline's "pre-workout fuel" block and the scoring window agree (consistency is the whole point). Proposed default ~90–120 min; `postTrailMin` ~90.

## 4. The rubric overlay — what a role changes

The engine centralizes every tunable in `MealScoringProperties` (`mezo.fuel.scoring.*`) + `NutritionTargetsProperties` (`mezo.nutrition.*`, kcal 3100 / p 220 / c 380 / f 95). A role is an **override overlay** on a *bounded, honest* subset of those tunables. **v1 keeps dimension WEIGHTS role-independent** (so the existing `@AssertTrue` 1.0-sum validation is untouched); the honest lever is **role-specific targets/limits**, i.e. "what the *right* amount is here", not "this dimension matters less here".

Role-sensitive dimensions in v1 (everything else is role-independent and honest regardless of training):

| dim | `standard` | `pre_workout` | `post_workout` |
|---|---|---|---|
| `macro` targets (P/C/F) | `mezo.nutrition` (27/47/26) | carb target ↑ (fuel), protein less critical | protein ↑ **and** carb ↑ (glycogen) |
| `who` sugar-energy-share-limit | 0.10 | **relaxed** (fast sugar = fuel) | moderately relaxed |
| `nova` group scores | 1.0/0.85/0.55/0.20 | **softened** (processed fuel acceptable — a gel is NOVA 4 and fine) | mildly softened |

`fat_quality`, `micro` (fiber), `plant_diversity`, `energy_density` stay role-independent. `context` already encodes timing/slot-share/protein; its **detail text names the role** (§6). Exact override numbers are tunables to settle during implementation (owner has the nutrition domain call) — the spec fixes the *structure and levers*, not the constants.

`standard` role = **no overrides = identity** → the exact v0 numbers, so rest-day and off-window meals are byte-for-byte unchanged.

## 5. Architecture & layering

Clean slice separation — **no direct meal→train entity coupling**; the meal side reaches train only through a small query service (mirrors the existing `WeeklyScheduledActivityService` pattern).

1. **New train-owned query** — e.g. `WorkoutWindowQueryService.windowsFor(userId, LocalDate date)` → `List<WorkoutWindow>` (each `{start, end, kind, done}`), assembled from the schedule slots + done signals of §3.1–3.2. Lives in `feature/train/`.
2. **`MealService.applyScore`** (`feature/meal/service/MealService.java:161`) fetches the windows for `meal.getMealDate()` and passes them into the scorer alongside the existing lines + local time. It stays thin (fetch + delegate).
3. **`MealScoringService.scoreMeal`** signature extends to accept the windows (e.g. `scoreMeal(slot, lines, localTime, List<WorkoutWindow> workouts)`). The service **derives the role internally** (pure classification of §3.3) and selects the rubric overlay. The scorer remains **pure / DB-free / fully unit-testable** — the windows are plain value carriers passed in, exactly like `lines`.

Role classification + rubric selection are pure functions in the nutrition/scoring domain → trivially unit-tested without a database.

## 6. Visibility (answers "where does the number come from")

- **v1, zero contract change:** the `context` dimension already carries `List<ContextRow>` (`MealBreakdownJson.ContextRow`, `nutrition/entity/MealBreakdownJson.java:75`). Add a role row (e.g. `("Szerep", "Pre-workout üzemanyag-ablak")`) and make the timing detail role-aware (e.g. *"a gyors szénhidrát itt üzemanyag"*). This already renders in `MealScoreSheet` (the FE maps the breakdown dimensions verbatim), directly explaining the score to the user.
- **Follow-up (not v1):** a first-class `role` field on the breakdown/`Dimension` for a proper **card chip** on the timeline `SlotCard` — that IS an OpenAPI + FE-type change, so it's deferred to keep v1 contract-neutral.

## 7. Config shape (`mezo.fuel.scoring` additions)

Add to `MealScoringProperties` (`feature/nutrition/config/MealScoringProperties.java`) and `application.yml` (`mezo.fuel.scoring`, currently at `application.yml:452-506`):

- Window params: `preLeadMin`, `postTrailMin`, `gymDefaultDurationMin` (validated ranges).
- A `roles` sub-record: `roles.pre` and `roles.post`, each an **override bundle** for the role-sensitive dims of §4 (macro target shares, who sugar limit, nova group scores). `standard` needs no entry (identity).
- Validation: each role's overridden values validate with the same `@DecimalMin/@Max` bounds as their base fields; **weights are not overridden in v1**, so the `Weights` `@AssertTrue` 1.0-sum invariants stand as-is.

Everything stays config-driven per `configuration_conventions.md` — no `@Value`, no hardcoded tunables in code.

## 8. Testing

Per `testing_standards.md` / `integration_test_framework.md` (integration-first, fixed `mezo_test` DB, AssertJ, `*Populator` data — **no mocks / no H2**):

- **Unit (pure):** role classification across window edges — meal exactly at `start − preLeadMin` (pre), at `end` (post, done), at `end` with workout NOT done (→ standard), no-workout day (→ standard), multiple-workout precedence.
- **Integration:** log the *same* PB-Banana-Toast-shaped meal
  - in the pre-workout window on a gym-scheduled day → score reflects the pre-workout rubric (carbs/sugar/NOVA no longer tank it; assert the `who`/`nova`/`macro` dimension scores lifted vs standard);
  - on a rest day (no workout) → **identical to today's v0 score** (regression guard);
  - post-workout after a **done** workout → recovery rubric; post-workout window but workout **not done** → standard.
- Assert the breakdown `context` role row is present and correct.

## 9. Out of scope (explicit)

- **Logged-meal name bug (mezo-u68c)** — independent, separate quick fix (render fallback + recipe-name carry-over + pantry manual naming). Not gated on this.
- **LLM coach layer (mezo-mr4n)** — hybrid step 2, deferred.
- **Recipe-fit / template-surface role awareness** — a recipe has no training context; its badge stays the context-free baseline.
- **Timeline card role chip** — contract + FE-type change, deferred (see §6).
- **Actual (vs planned) workout start times** — not stored; plan time is the honest available signal (§3.2).

## 10. Open tunables to settle in implementation

1. Exact `preLeadMin` / `postTrailMin` / `gymDefaultDurationMin` (reconcile `preLeadMin` with the FE fuel anchor).
2. Exact role override constants (carb/protein target shifts, sugar-limit relaxation, NOVA softening) — owner's nutrition call.
3. Whether `post_workout` precedence over a later `pre_workout` is the right tie-break (§3.3) once real multi-workout days appear.
