# Fuel Completion Roadmap — phased master plan (P0–P8)

> **What this is.** The single durable map for finishing the **Fuel** domain after the Slice C core
> (Pantry `mezo-9xu`, Recipes `mezo-lns`, Meal-logging `mezo-arb`) shipped. It is a *roadmap of phases*,
> not an implementation plan — each phase gets its OWN dated `specs/` + `plans/` artifact when we start it
> (brainstorm → spec → plan → TDD impl). Track live state in **bd** (epic `mezo-6r1`, one child per phase);
> read THIS for the why/scope/dependencies of each phase.
>
> **How to carry it forward in a fresh session:** run `bd ready` to see the next unblocked phase, open its
> bd issue for the one-line scope, then read the matching `P#` section here for the full brief. Each phase
> is self-contained: build it, then the next one unblocks.

**Driving principles (decided 2026-06-26):**
- **Dependency-ordered** — cheap decisions/ADRs first, then slices in the order they unblock each other. Minimal rework.
- **Deterministic-first** — where a surface has a sensible non-AI version (the 4 numeric meal-score dimensions, heuristic suggestions, OpenFoodFacts import), build that in Phase 2. The genuinely-AI layer (learned timing, replan cascades, prose/confidence) is sketched as Phase 3 (`P8`), built when the AI brain (Spring AI / pgvector / pattern engine) lands.
- **Hook-signature stability** — the 6 still-mock Fuel hooks gain the `isMockMode() ? mockConst : fuelApi.x()` + `useQuery`/`useMutation` + `initialData` branch (copy `useWeight` / the shipped `usePantry`); view/component signatures must NOT change. This is the Phase-2 contract.
- **"The AI is theater" today** — `buildProtocol`, meal scores, NOVA classifications, replan cascades, scrape previews are pre-written fixtures. Deterministic data + math replaces the buildable ones now; real intelligence waits for `P8`.

**Where we are.** 3 of 9 Fuel hooks are real/dual-mode (`useFuelDay`, `useMealActions`, `useRecipeLogs`, plus `usePantry`/`useRecipes`). 6 remain mock-only one-liner const spreads (`useFuelTimeline`, `useStack`, `useProtocol`, `useFuelWeek`, `useReplanScenarios`, `useStackRecommendations`). There is **no** `api/feature/fuel/fuel.yml`, no `backend/.../feature/fuel/`, no `frontend/src/lib/fuelApi.ts` yet — the Stack/Protocol slice (`P2`) creates them. Source map: `docs/features/fuel.md` (living doc), master design spec `docs/superpowers/specs/2026-06-10-phase2-backend-design.md` (Slice C row).

**⏸ Parked (explicitly out of this roadmap):** **stock / inventory tracking** (`mezo-6nu`) — qty / expiry / low-stock warnings — is hidden behind `SHOW_PANTRY_STOCK = false` (`frontend/src/lib/flags.ts`). Backend `pantry_item` stock columns stay intact (`mezo-dh6` partial-merge), so it returns later with a flag-flip + a dedicated phase. Knock-on: the Suggestions "restock-before-runout" / "fogy ki X nap" consumption-rate idea (`P6`) is **dropped** while stock is parked; cheaper-alternative + low-NOVA-swap heuristics still ship.

---

## Phase brief format

Every phase below uses the same shape so a fresh session can act on it without re-deriving:
**Goal · Builds (deterministic, now) · Out / deferred · Backend · FE hook swap · Depends on · Size · Open decisions (brainstorm fodder) · bd**. Sizes: S/M/L/XL relative to the shipped pantry/recipe/meal slices.

---

## P0 — Decisions / ADRs (prerequisites, ~no code)

Three cheap decisions that unblock the rest. Each is an ADR in `docs/decisions/` (see `docs/README.md` for the template); no feature code. Do these first — they prevent the `P2`/`P4`/`P5`/`P7` clusters from silently rebuilding or diverging.

- **P0a — Train-schedule ownership.** Fuel's `FuelPlanView` edits a private, never-persisted mock (`fuelWeek.ts` `gymSchedule` + `today.ts` `volleyballSessions`), while Train already OWNS the real weekly schedule (`gym_schedule_slot`, `sport_schedule_slot`, `PUT/GET /api/train/{gym,sport}-schedule`, `useTrain().saveGymSchedule/saveSportSchedule`). **Decision:** Fuel's `GymScheduleSheet` writes through to Train's schedule (Fuel = secondary editor/consumer), NOT a duplicate `fuel_gym_schedule` table. Bridge the shape gap (`GymScheduleDay` type/duration vs Train's `dayOfWeek`+time — reuse `trainHooks.deriveGymSchedule`). **Blocks:** `P4`, `P5`. First leak already filed: `mezo-m1l` (real volleyball ambient into GoalTimeline).
- **P0b — `food_item` ↔ `pantry_item` + `supplement_intake`/`medication` table fate.** Record that `pantry_item` (Model B, `kind` discriminator) supersedes the spec's `food_item`, and that `nutrition_targets` shipped as `@ConfigurationProperties` not a table. Decide whether `supplement_intake` reuses `pantry_item` supplement rows (FK) for intake events and whether Reta is `pantry_item` / `medication` / both. **The Reta half is DECIDED & SHIPPED (P3 / mezo-d94, 2026-06-26): Reta is first-class `medication` + `medication_dose`, NOT a `pantry_item` row** — the cycle is server-derived from the dose log, and there is no pantry shelf card for it (the spec's earlier "Reta in pantry, de-dup via `stashRefId`" decision is superseded). The `supplement_intake` half is still open, owed to `P2`. **Blocks:** `P2` (still); `P3` (resolved — shipped).
- **P0c — Meal-score jsonb-envelope ADR.** Owed in TWO places (`fuel.md` §7 step 8 + the meal-logging spec §175.8). Record: reuse Train's `ProvenanceEnvelope` typed-jsonb pattern, the 4-dimension weighted model (.30/.25/.25/.20), deterministic-v0 vs AI split, and whether a denormalized numeric `meal.score` column accompanies the jsonb. **Blocks:** `P7`.

**Size:** S each. **bd:** `mezo-ut1` (one issue covering P0a/P0b/P0c).

---

## P1 — Water logging (quick win)

**Goal:** make the `MacroHero` water ring honest — today `FuelDayService` sets `consumed.water = targets.water` (always 100%).
**Builds:** a real per-day water sum + a `+víz` quick-capture.
**Out/deferred:** goal/Reta-aware water targets (stays config constant).
**Backend:** `water_log` table (smallest owned single-row aggregate — `created_by`, soft-delete, `log_date`, `amount_ml`; weight/sleep-log precedent), `WaterLogEntity`+repo+service, `FuelDayService.consumed.water` = Σ for the day. Contract: `POST /api/water-log` (extend `api/feature/meal/meal.yml` — the day rollup already flows through `FuelDayResponse.consumed.water`). Liquibase migration `{ts}_{id}_create_water_log.sql`.
**FE hook swap:** `useFuelDay` already carries `consumed.water` through — no signature change; add `useWaterActions.logWater(amountMl)` (mock: `setQueryData` on `['fuelDay']`; real: POST + invalidate) and a `+250/+500 ml` chip on `MacroHero`. Stop `recomputeConsumed` forcing `water = targets.water`.
**Depends on:** nothing (Meal/FuelDay shipped). **Size:** S. **Deterministic.**
**Open decisions:** discrete `water_log` rows (recommended, undo + matches conventions) vs a per-day counter; chip vs sheet affordance.
**bd:** `mezo-0z5`.

---

## P2 — Stack / Protocol

**Goal:** make the Stack tab real — log when a supplement/stim is taken, and persist a versioned daily protocol so "Bekapcsolás · ma" / "Mentés protokollként" stop being inert toasts.
**Builds:** supplement-intake events + protocol persistence + the **new `api/feature/fuel/fuel.yml` fragment** (greenfield — first Fuel-owned backend package). `buildProtocol` stays deterministic (FE computes the slots; BE stores the chosen selection + version, or recompute on read).
**Out/deferred:** learned/personalized supplement timing → `P8`. `useStackRecommendations` stays `[]`-in-real until `P8`.
**Backend:** `supplement_intake` table (FK the `pantry_item` supplement row — supplements already live in `pantry_item`; `taken_at`, dose snapshot, day key, optional slot + skip-reason). `protocol` table (versioned; `version`, `built_at`, `status='active'`, `confidence`, `last_replan_reason` + a history jsonb or `protocol_history`). `ProtocolService`. `fuel.yml`: `GET/POST /api/fuel/stack`, `POST /api/fuel/supplement-intake`, `GET/POST /api/fuel/protocol`. Config: protocol confidence default, kcal floor (currently hardcoded 2500) as `mezo.*` `@Validated` props. demodata seed (Java). `ResetDatabase` TRUNCATE + `SupplementIntakePopulator`/`ProtocolPopulator`.
**FE hook swap:** `useStack`/`useProtocol` → dual-mode (`useStack` should COMPOSE the pantry-sourced stash + an intake query — supplements' stash already resolves from `pantryApi.list()`, don't introduce a 2nd source of truth). New `useStackActions`/`useProtocolActions` (logIntake/skip, applyProtocol, saveProtocol).
**Depends on:** `P0b`. Pantry + Meal shipped. **Size:** L. **Deterministic** (`buildProtocol` is rules, not a model).
**Open decisions:** persist computed slots vs only {selected ids + version}; where intake done-state lives (unify so one log updates the Mai timeline AND weekly adherence); weekly supplement matrix as its own table vs folded into protocol.
**Folds in:** `mezo-4nu` (FuelStackView `/api/goals` decouple — hit exactly when this view is wired).
**bd:** `mezo-09g`.

---

## P3 — Medication / Reta cycle ✅ SHIPPED (mezo-d94, 2026-06-26)

> **Shipped — diverged from the brief below in one key way: built as its OWN feature, not folded into `fuel.yml`.** It got a dedicated `api/feature/medication/medication.yml` contract + `backend/.../feature/medication/` package (`medication` + `medication_dose` tables, `MedicationController`/`MedicationService`/`MedicationCycleService`), the `/fuel/gyogyszer` tab (`FuelMedicationView` + `LogDoseSheet` + `MedicationCycleBar`), and dual-mode `useMedication`/`useMedicationActions` (`medicationHooks.ts` + `medicationApi.ts`). Endpoints landed as **`GET /api/medication`**, **`PUT /api/medication/{id}`**, **`POST/DELETE …/{id}/dose`** (NOT under `/api/fuel/*`). `retaDay` is **derived** by `MedicationCycleService` (`days-since-newest-dose + 1`, clamped) and broadcasts via `useTodayScenario().retaDay`; the `?retaDay=` URL override stays top-priority. The `retaWeek` weekly-plan swap stays `P4`. Design spec: `docs/superpowers/specs/2026-06-26-fuel-medication-design.md`. Living doc: `docs/features/fuel.md` §3/§4/§9.

**Goal:** make the Retatrutide medication real — persist weekly subQ dose events and DERIVE the 7-day appetite cycle (D1-2 Peak → D3-5 Stable → D6-7 Trough) from the actual last-dose date instead of the hardcoded `today.retaDay = 3`.
**Builds:** `medication` + `medication_dose` tables, server-derived `retaDay`/phase, dose-logging.
**Out/deferred:** a personalized appetite curve fitted to logged pacing → `P8`. Cross-domain Reta strings in Insights/Train/Goals/Chat stay frozen mock until Slice D. The `useFuelWeek` `retaWeek` swap to the real medication moved to `P4` (the Gyógyszer slice broadcasts `retaDay` but left the weekly-plan strip on its mock `retaWeek` cells).
**Backend:** `medication` (drug def: Retatrutide, subQ, weekly cadence, a `cycle jsonb` of `cycleLengthDays` + `phases[]`) + `medication_dose` (each injection: `administered_at` + a derived `administered_date`, dose, note; FK `ON DELETE RESTRICT`, soft-delete). `MedicationCycleService.derive`: `retaDay = days-since-newest-dose + 1`, clamped to `cycleLengthDays`, phase from the config `phases[]`, honest-zero when no dose. demodata: `MedicationDemoLoader` (`@Profile("demodata")`). ITs: `MedicationApiIT`/`MedicationServiceIT`/`MedicationCycleServiceIT` + populators in `ResetDatabase`. (Did NOT use `fuel.yml`/kcal-floor-per-phase config — those stay `P2`/later.)
**FE hook swap:** `useTodayScenario().retaDay` derives from `useMedication().cycle.retaDay` in real mode (**the `?retaDay=` URL override stays top-priority in BOTH modes** — `hooks.test.tsx` asserts it). New `useMedicationActions.{logDose,removeDose,updateMedication}`. This is the highest-leverage swap (every Reta surface reads `retaDay`).
**Depended on:** `P0b` (resolved — Reta is first-class `medication`, see below). Built independently of `P2`/`fuel.yml`. **Size:** M (actual). **Deterministic** (config + date-math).
**Resolved decisions:** Reta is modeled as **`medication` + `medication_dose`** (first-class), **NOT** a `pantry_item` row — the cycle is **server-derived from the dose log**, not stored. (The earlier "Reta keeps a `pantry_item` shelf card, de-dup via `stashRefId`" idea was dropped — the Gyógyszer tab is the single Reta surface.) Cadence is still effectively weekly via the cycle config; generalizing beyond it is future work.
**bd:** `mezo-d94`.

---

## P4 — Weekly Plan / Rhythm (Terv)

**Goal:** make the Terv weekly view real — gym-time edits persist (they vanish on reload today), and the week grid / Reta strip / weekly stats feed from real data.
**Builds:** `GymScheduleSheet` writes through to Train's `PUT /api/train/gym-schedule` (per `P0a`); `WeekRhythmGrid` renders the real Train gym + volleyball week; `weeklyStats` (kcal avg / protein-hit days) from the now-real per-day meal rollups.
**Out/deferred:** supplement-adherence % waits on `P2`'s `supplement_intake`; `recurringPatterns` ("Pattern P2 megerősítve") is `P8` pattern-engine output (stays static config in v1).
**Backend:** none new for the schedule (reuse Train). `weeklyStats` derives from `/api/fuel/day` rollups (a small read-model / aggregate). Possibly extend `gym_schedule_slot` if Fuel needs type+duration on the grid (or reuse `deriveGymSchedule`).
**FE hook swap:** split `useFuelWeek` — `gymSchedule`/`volleyball` from `useTrain()`, `retaWeek`/`retaDay` from `useTodayScenario()` (real after `P3`), `weeklyStats` real. Likely a `fuelWeekHooks.ts` composing `useTrain` + static config.
**Depends on:** `P0a` (Train ownership — hard gate), `P3` (retaWeek). Meal shipped. **Size:** L. **Deterministic.**
**Open decisions:** the `GymScheduleDay` vs `GymScheduleSlot` shape bridge; which `weeklyStats` are real now vs deferred; date-derive the hardcoded "Máj 18 – 24" title + `currentDay={3}`.
**bd:** `mezo-kpo`.

---

## P5 — Fuel-Timeline view (the deferred merged VIEW)

**Goal:** replace the hand-authored mock pacing timeline (`FuelMaiView` slot list + Today's `FuelTimelinePreview`) with a real merged agenda joining logged meals (real) + supplement/medication intakes (`P2`/`P3`) + the day's gym/volleyball blocks (Train), with state (done/now/pending). This is the explicitly-deferred "fuel-timeline merged view" (master spec + meal-logging spec §1).
**Builds:** the meal + schedule halves join NOW (both real); the supplement/medication half lights up once `P2`/`P3` land.
**Out/deferred:** the `mezoNote`/`pacing.msg` narrative + meal score are `P8`/`P7`.
**Backend:** a read composition — `GET /api/fuel/timeline/{date}` (or extend `/api/fuel/day`) joining meal rows (real) + `supplement_intake`/`medication_dose` (`P2`/`P3`) + Train `gym_schedule_slot`/`sport_schedule_slot`/sessions. Cross-feature read (Fuel consumes Train, same direction as recipe→meal_item). Replace the brittle title-string `getScoredMeal` join with the real meal-id relation meal-logging already provides.
**FE hook swap:** `useFuelTimeline`/`useFuelPreview` compose `useFuelDay` (real) + `useTrain` (real) + `useStack` (after `P2`). Slot state derivable client-side (the preview's `nextStack` logic already assumes this).
**Depends on:** `P0a` (Train ownership), `P2` (supplement_intake for the full timeline). Meal + Train shipped. **Size:** L. **Deterministic** (joins + scheduling math).
**Open decisions:** DB view vs service composition vs client-side merge of three queries (client merge ships the meals+schedule halves NOW; only the supplement half is gated); build meals+schedule now and leave supplement slots interim, or wait for `P2`.
**bd:** `mezo-9ys`.

---

## P6 — Kamra Import (OpenFoodFacts) + Suggestions (heuristic)

**Goal:** let the user add a pantry item by external lookup instead of typing macros, and surface heuristic "add this" suggestions.
**Builds (Import):** OpenFoodFacts barcode/text lookup → a draft `PantryItemRequest` the user confirms → the existing create path persists it; an `imports` activity feed.
**Builds (Suggestions):** cheaper-alternative (by category+price vs the 146-item catalog) + low-NOVA-swap heuristics.
**Out/deferred:** the per-vendor HTML SCRAPE wizard (brittle, needs an AI extractor) → `P8`; "stack-fit/recipe-fit" reasoned suggestions → `P8`; **restock-before-runout + consumption-rate suggestions are DROPPED while stock is parked (`mezo-6nu`)**; camera/OCR/barcode-scan chips stay inert for v1.
**Backend:** an OpenFoodFacts client (deterministic HTTP, NOT AI — OFF carries a `nova_group` so NOVA is a passthrough), `POST /api/pantry/import|lookup`, a lightweight `pantry_import` table feeding `imports`, extend `PantryResponse` with `imports[]`+`suggestions[]`. `@ConfigurationProperties` for the OFF base URL/timeout/UA + `mezo.feature.pantry-import.enabled` toggle. **Must resolve `mezo-w3o`** (pantry mapper `*.fromValue` 500 on out-of-enum source — new vendors hit this) and couple new source-enum values with the FE `PantrySourceKey` union.
**FE hook swap:** `usePantry` `imports`/`suggestions` dual-mode (real reads from `pantryApi.list`); re-mount `ImportItemSheet` (exists, unmounted) + `SuggestionCard`; a `useImportPantryItem` mutation.
**Depends on:** Pantry shipped; `mezo-w3o`. **Size:** L (Import) + M (Suggestions). **Deterministic** (OFF integration + heuristics).
**Open decisions:** OFF-only vs URL-scrape (recommend OFF now, scrape → `P8`); one item per import vs basket; which `ImportItemSheet` source chips map to OFF vs manual.
**bd:** `mezo-bka`.

---

## P7 — Meal-Scoring (deterministic v0)

**Goal:** turn the inert pending-sparkle on every logged meal + recipe-fit into a real, explainable 4-dimension Mezo score. The entire read surface already exists end-to-end (`MealScoreSheet`, `ScoreHero`, `DimensionCard`, the 4 panels, `RecipeFitBadge`, the `RecipeLogsList`/`SlotCard` pending states) and merely awaits a populated `meal.breakdown` jsonb — **zero new UI**, only backend + the `mealApi.fromResponse` mapping.
**Builds (deterministic v0):** the 4 NUMERIC dimensions — Macro (ratio vs `NutritionTargetsProperties`), Micro (per-meal micro pct vs target), NOVA (from the already-persisted `meal_item.snapshot_nova`), Context (slot/timing fit). Weighted total `.30/.25/.25/.20` + a numeric confidence.
**Out/deferred:** the `summary`/`improve[]` PROSE + a calibrated confidence narrative → `P8` (needs the brain).
**Backend:** replace the placeholder `MealBreakdownJson` record with the full typed envelope (mirror the FE `MealBreakdown`, model on Train's `ProvenanceEnvelope` per `P0c`). A `ScoringService` computing the 4 dims from items+macros+config; populate `meal.score` + `meal.breakdown` on write or a recompute pass. Tighten `MealScore.breakdown` in `meal.yml` from the loose `additionalProperties:true` to a typed `MealBreakdown` schema. Micronutrient source: confirm `pantry_item`/`recipe` micros survive the round-trip (the Micro dimension's only missing data). Recipe fit-score likely shares the same service.
**FE hook swap:** none structural — `mealApi.fromResponse` maps `score.value`→`FuelMeal.score` and `score.breakdown`→`FuelMeal.breakdown` (today it nulls breakdown); `recipeApi.fromResponse` lights up `recipe.mezoFit.score`.
**Depends on:** `P0c` (ADR), micronutrient persistence. **Size:** XL (v0 is the numeric half). **Deterministic v0; prose is `P8`.**
**Folds in:** `mezo-2dy` (NOVA contract type drift), `mezo-0xh.30` (NOVA palette parity), `mezo-24j` (fixture macro drift) — all surface when the NOVA dimension goes live.
**bd:** `mezo-yta`.

---

## P8 — Phase-3 AI (sketch — built when the brain lands)

Not buildable on core data; needs Spring AI / pgvector / a pattern-correlation engine (roadmap Phase 3). Each gets its own design spec at Phase-3 start; likely a shared AI-engine spec.
- **Meal-Scoring prose layer** over `P7`'s numeric v0: `summary` / `improve[]` / calibrated `confidence`.
- **AI Replan** (`ReplanSheet`): a real context-change → cross-system cascade (Fuel/Train/Sleep) + tool-call transparency + protocol v+1, with a real scheduling-recompute engine. XL.
- **Stack Recommendations**: HRV/Reta/load-reasoned supplement recommendations with expected-metric + confidence. L. (A thin "stack-gap vs a best-practice template" heuristic could ship earlier if wanted.)
- **Suggestions reasoning** (`P6` tier b): stack-fit / recipe-fit / casein-window prose.
- **Learned supplement timing** + **personalized Reta appetite curve** over `P2`/`P3`.
- Infra: pgvector knowledge base (supplement→effect evidence) + the pattern store, shared across Replan + Recommendations.

**bd:** `mezo-0h6w` (umbrella; real specs filed at Phase-3 start).

---

## Cross-cutting / housekeeping

- **Close the duplicate epic `mezo-4ag`** (Kamra UX) — its work shipped via `mezo-g0u` + `mezo-bi5`; it is a stale `in_progress` signal. (Done as part of authoring this roadmap.)
- **Keep `mezo-2hp` open** (Goal-system) — the intentional Phase-3 anchor for adaptive TDEE; only P3 follow-ups remain in Phase 2.
- **P3-polish backlog** (fold into the matching phase where noted, else a cleanup batch): `mezo-q5y` (recipe editor UUID line), `mezo-w3o` (→ `P6`), `mezo-7vw` (recipe picker category chips), `mezo-24j`/`mezo-2dy`/`mezo-0xh.30` (→ `P7`), `mezo-be4` (jsonb serialization — the proof `P7` reuses), `mezo-4wd` (doc-flag cleanup), `mezo-4nu` (→ `P2`), `mezo-m1l` (→ `P0a`/`P4`).

## Dependency graph (quick reference)

```
P0a ─┬─► P4 ─► P5
     └─► P5
P0b ──► P2 ─┬─► P3 ─► P4
            └─► P5
P0c ──► P7
P1  (independent quick win)
P6  (independent; needs mezo-w3o)
P8  (after the AI brain; layers over P2/P3/P6/P7)
```

## Per-phase execution checklist (when you start a `P#`)

1. `bd update <the phase's bd id> --claim`; brainstorm (superpowers:brainstorming) → write a dated `docs/superpowers/specs/` design spec → a dated `docs/superpowers/plans/` implementation plan.
2. Contract-first: edit/create the `api/feature/<name>/*.yml` fragment BEFORE code; merge; regen FE + BE types.
3. TDD per the backend references (`docs/references/`): repro/failing test first → implement → green. Integration-first (Testcontainers/compose `mezo_test`), AssertJ, populators.
4. Dual-mode FE: swap the mock hook to `isMockMode() ? const : fuelApi.x()` (copy `useWeight`); keep signatures; both modes green + `pnpm build`.
5. Update `docs/features/fuel.md` (the affected sections) + `docs/milestones/roadmap.md`; `node scripts/lint-docs.mjs`.
6. One bd issue + one `feat/` branch; `--no-ff` merge (`git pull --rebase` BEFORE the merge, not after); push.
