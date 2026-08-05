# Fuel meal-slot templates design

**Issue:** `mezo-7102`
**Date:** 2026-08-05
**Scope:** Fuel — user-defined meal slot structure with two-tier AI evaluation

## Problem

The day planner (`placeWindows` in `frontend/src/features/fuel/logic/buildDayPlan.ts`) is fully
algorithmic: wake/bed + `mealsPerDay` (3–6) + the day's training blocks produce fixed-name windows
(Reggeli/Ebéd/Vacsora + snacks + a peri-workout snack) with weight-based budget splitting
(`SLOT_WEIGHT`). The user cannot express their real structure:

- Waking 05:30 with 07:00 training, the engine anchors a ~500 kcal Reggeli at ~06:13. The user
  wants a small pre-workout snack before, and a protein-rich breakfast after the session.
- The user eats "Ebéd 1" and "Ebéd 2" — two real lunches with different budgets, neither a snack.
  The engine has no vocabulary for that.

The goal-based recommendation (training-aware, as today) must remain the starting point; the user
manually overrides it, and the AI evaluates the custom split before it is finalized.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Granularity | Per **day type**: `rest` / `training_am` / `training_pm`; auto-picked from the day's blocks |
| Slot timing | **Mixed anchors** per slot: fixed HH:mm OR relative (wake+X / training_start−X / training_end+X / bed−X) |
| Slot budget | **Percent of the dynamic daily budget** (sum = 100%), UI shows live kcal |
| Macros | **Role preset** per slot: `standard` / `pre_workout` (carb-forward) / `post_workout` (protein-forward) |
| AI evaluation | **Two-tier**: instant deterministic guardrails while editing + on-demand LLM verdict before finalizing |
| Architecture | **Template overlay**: `placeWindows` untouched; template path is additive; no template ⇒ byte-identical current behavior |

## 1. User experience

**New full page `/fuel/slots` — "Étkezési ablakok"** — a sibling of the `fuel` tab group (outside
its `children`, the `RecipeEditorPage` routing pattern), so it renders without Fuel sub-nav chrome.
Entry point: a new "Étkezési ablakok szerkesztése ›" row in `FuelSettingsSheet`.

Top of page: a segmented **day-type switcher** (`Pihenőnap / Reggeli edzés / Esti edzés`). Each day
type is in one of two states:

- **Recommended (automatic)** — no template exists: a read-only preview of the current engine's
  output for a reference day of that type, plus a **"Testreszabás"** button that forks the preview
  into an editable template (the recommended plan is the seed). While no template exists, runtime
  behavior is exactly today's.
- **Custom template** — an editable slot list. Each row:
  - **name** — free text ("Ebéd 1", "Pre-workout snack");
  - **type** (`slotKind`) — Reggeli / Ebéd / Vacsora / Snack; maps to the existing meal-log `slot`
    enum, keeping log filling, `LogMealSheet` prefill and the API contract unchanged;
  - **role** — Általános / Edzés előtt / Edzés után (macro bias, below);
  - **anchor** — fixed HH:mm, or relative: ébredés+X / edzés−X / edzés vége+X / lefekvés−X;
  - **budget %** — percent of the daily budget.

  Below the list: a Σ% meter (must be 100%) and a live preview — anchors resolved against a
  **reference day** of that type, kcal computed from today's actual daily budget. Reference day =
  today when today matches the day type; otherwise a synthetic sample built from the live sleep-goal
  wake/bed plus a canonical block (07:00 gym for `training_am`, 18:00 for `training_pm`).

**Validation + finalize:** deterministic guardrails run live while editing (§4). The save bar
carries a **"Mezo értékelése"** button → LLM verdict card (Hungarian prose + per-slot suggestions).
Errors block saving; warnings and the LLM verdict never do — the AI advises, it does not gate.
When the LLM is unavailable (flag off / error), the editor honestly states that only the
deterministic tier is active (the recipe-breakdown degrade pattern). **"Ajánlott visszaállítása"**
deletes the template for that day type (reverting to the automatic engine).

## 2. Data model

Backend table **`meal_slot_template`** (one row per user per day type):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `created_by` | uuid | owner, set server-side; `uq_meal_slot_template_owner_day_type (created_by, day_type)` |
| `day_type` | text enum | `rest` / `training_am` / `training_pm` |
| `slots` | jsonb | typed embedded list (`@JdbcTypeCode(SqlTypes.JSON)`), ≤ 8 items |
| `is_deleted` | boolean | soft delete (`@SQLRestriction`/`@SQLDelete`) |
| `created_at` / `updated_at` | timestamptz | house standard |

`slots` item shape:

```json
{
  "label": "Ebéd 1",
  "slotKind": "lunch",
  "role": "standard",
  "anchor": { "type": "fixed", "time": "12:00" },
  "budgetPct": 20
}
```

`anchor.type` ∈ `fixed` (with `time`) | `wake` | `training_start` | `training_end` | `bed`
(each with `offsetMin`, signed; e.g. training_start with `offsetMin: -45` = edzés−45p).

Templates are document-like (always read/written whole):

- `GET /api/fuel/slot-templates` — all templates of the owner (0–3 rows);
- `PUT /api/fuel/slot-templates/{dayType}` — whole-document upsert;
- `DELETE /api/fuel/slot-templates/{dayType}` — soft-delete ⇒ revert to recommended.

Contract-first in `api/feature/fuel/fuel.yml` (tag `Fuel`), backend implements the regenerated
`FuelApi`. Day type is resolved at runtime from the day's blocks — never stored on the day.

Mock mode: no seeded templates (recommended state); edits live as cache mutations for the session —
the usual dual-mode pattern.

## 3. Engine integration (frontend logic)

Two new pure functions under `features/fuel/logic/`, no changes to existing ones:

- **`resolveDayType(blocks) → 'rest' | 'training_am' | 'training_pm'`** — no blocks → `rest`;
  earliest block starts before 12:00 → `training_am`; otherwise `training_pm`.
- **`compileTemplate(template, {wake, bed, blocks}) → PlannedWindow[]`** — anchor resolution:
  `fixed` → its time; `wake+X` / `bed−X` off the sleep-goal anchors; `training_start−X` off the
  **earliest** block start; `training_end+X` off the **latest** block end (the same envelope
  principle as today's snaps). Then the unchanged tail discipline of `placeWindows`: clamp into the
  eating span (wake+45 → bed−90), sort, `MIN_SLOT_GAP_MIN` forward-push.

`buildDayPlan` step 1 branches: `template ? compileTemplate(...) : placeWindows(...)`. Without a
template the behavior is byte-identical to today. `PlannedWindow` gains optional `budgetPct` and
`role` fields (absent on the legacy path).

**Budget splitting on the template path — `splitBudgetPct`:** kcal per slot from the user's
percents; the P/C/F columns get role multipliers (pre_workout: carbs up, fat+protein down;
post_workout: protein up), then each macro column is normalized so **Σ slots = daily budget exactly
per macro**; rounding drift is absorbed by the largest-pct slot (today's dinner-absorbs principle).
Multipliers are tunable constants in `fuelConfig.ts`.

**Explicitly unchanged:** meal-log window filling (two `lunch`-kind windows — "Ebéd 1"/"Ebéd 2" —
fill in loggedAt order; the existing per-slotKey cursor already supports this), `pickRecipe`
(category = slotKind), backend meal-score role classification (still derived from the day's workout
windows — no contract change), and `LogMealSheet` `initialSlot`. The `fuel_slot` notifications ride
`buildDayPlan` output, so custom slot times propagate automatically — verify during implementation.

## 4. Two-tier AI evaluation

**Tier 1 — deterministic guardrails.** Pure `validateSlotPlan(slots, compiled, ctx) →
{errors[], warnings[]}` in `features/fuel/logic/`, run live by the editor.

- **Errors** (block save): Σ budgetPct ≠ 100 (±1); fewer than 2 slots; more than 8 slots; a slot
  resolving outside the wake→bed span; a training-anchored slot in the `rest` template.
- **Warnings** (advisory): resolved gap < `MIN_SLOT_GAP_MIN` (90 min); a `pre_workout`-role slot
  over 15% or over ~300 kcal; the last third of the day carrying > 40% of the budget; a slot past
  kitchen close (bed−90).

**Tier 2 — LLM verdict.** `POST /api/fuel/slot-templates/evaluate` — stateless, nothing persisted.
Request: dayType, slots, resolved sample times, a daily-budget snapshot (kcal/P/C/F), the goal
balance, and the sample day's training blocks. Response:
`{ verdict: 'ok' | 'adjust', summary, suggestions: [{ slotLabel?, text }] }` in Hungarian.

This is the project's **4th LLM-backed endpoint**, following the established idiom: consumer-owned
port **`SlotPlanLlm`** in `feature/fuel`, adapter provided by companion (ADR 0012), gated on
`mezo.feature.slot-template-ai.enabled`. Flag off / LLM error → the FE shows the honest
deterministic-only note; evaluation never gates saving.

FE: a `useSlotTemplateEvaluation` mutation hook; mock mode returns a canned verdict after the demo
delay.

## 5. Backend slice

- Liquibase: `{ts}_mezo-7102_create_meal_slot_template.sql` — explicit `pk_/fk_/uq_` names, the
  columns of §2.
- `feature/fuel` extension: `MealSlotTemplate` entity (typed jsonb slots), repository,
  `SlotTemplateService` (CRUD + server-side validation mirroring the deterministic **errors** of §4
  as `SystemRuntimeErrorException` + `SystemMessage` codes), `SlotPlanEvaluationService` behind the
  gated endpoint, MapStruct mapper onto the generated `api.dto` models, `FuelController` grows the
  new operations.
- Test infra: a `MealSlotTemplatePopulator`, the table joins the `ResetDatabase` TRUNCATE list.
- Evaluate ITs stub the `SlotPlanLlm` port (the scrape/meal-draft IT pattern).

## 6. Delivery, testing, docs

Shippable as **two PRs**, each independently valuable:

1. **Templates + engine + editor** — table/CRUD, `resolveDayType`/`compileTemplate`/
   `splitBudgetPct`/`validateSlotPlan`, the `/fuel/slots` editor with deterministic validation,
   `FuelSettingsSheet` entry, `buildDayPlan` branch.
2. **LLM evaluate** — port + adapter + endpoint + the "Mezo értékelése" card.

Testing:

- **FE unit:** `compileTemplate` (anchor kinds, clamping, gap-push, midnight-crossing bed),
  `splitBudgetPct` (per-macro Σ preservation, role bias, drift absorption), `resolveDayType`,
  `validateSlotPlan` (each rule).
- **FE component:** editor page (fork-from-recommended, edit, save, reset, evaluate states),
  `FuelMaiPage` with a template active (renamed/re-timed windows, no-template regression). Both
  modes green + build.
- **BE IT:** CRUD + ownership + upsert + validation-error + evaluate (stubbed port) via
  `ApiIntegrationTest`. Focused tests locally; the full suite runs on the CI gate.

Docs: this spec; `docs/features/fuel.md` (§2 routes, §4 endpoints, engine sections) updated in the
shipping PRs; `node scripts/lint-docs.mjs` after.
