# Fuel Medication (Gyógyszer) Slice — Design Spec

**Date:** 2026-06-26
**Driving bd:** `mezo-d94` (roadmap phase **P3**); revises `mezo-ut1` (**P0b** ADR)
**Mirrors:** the owned-aggregate event-log pattern of `meal`/`meal_item` (`mezo-arb`) and `run_session_log` (`mezo-b4n`); dual-mode hook pattern of `useFuelDay`/`useWeight`
**Roadmap:** [`fuel-completion-roadmap`](../plans/2026-06-26-fuel-completion-roadmap.md) P3
**Status:** approved design (brainstormed with mockups 2026-06-26) → ready for implementation plan

---

## 1. Goal & Scope

Give the **Retatrutide (Reta) medication a first-class home**: a new **"Gyógyszer" Fuel sub-tab** where you log actual injections, and from which the app derives the 7-day appetite cycle (`retaDay` + phase) and **broadcasts that one truth everywhere it matters**. Today the Reta cycle is pure mock — `today.retaDay` is hardcoded to `3`, `retaWeek` is a static 7-cell array, and the medication is a `pantry_item` row with `kind='med'` carrying free-text `protocol`/`timing` and no dose history.

**Chosen data model: A — dose log (event-based).** You record only the *actual injections* (date + dose); the cycle day and phase are *computed* from them. No separate "course" object; titration (2→4→6 mg) is visible from the actual dose values over time, not planned.

**In scope (P3):**
- `medication` + `medication_dose` tables (a first-class medication domain), replacing the `pantry_item` `kind='med'` modeling for Reta.
- New **"Gyógyszer"** tab under `/fuel` (`FuelSubNav` + router): the medication card + 7-day cycle bar + phase note + dose log + a **"＋ Beadás"** capture sheet (date · time optional · dose · note).
- A `MedicationCycleService` deriving `{ retaDay, phase, lastDoseAt }` from the dose log + the medication's cycle config.
- Dual-mode `useMedication` / `useMedicationActions` hooks (the `useWeight`/`useFuelDay` pattern).
- **Broadcast:** `useTodayScenario().retaDay` becomes derived in real mode (the hardcoded `3` is gone), feeding Today (briefing retaDay + Reta anchor), Fuel/Mai (`RetaPhaseBar`), Fuel/Terv (`RetaWeekStrip`, today hardcoded `currentDay={3}`). The `?retaDay=` URL override stays for demos/tests.

**Out of scope / deferred:**
- **The phase → calorie rule is NARROW (out):** the medication domain only *produces* `retaDay`/phase. Turning a phase into a kcal-floor / appetite adjustment lives on the meal-targets side (`NutritionTargetsProperties` + `goal.prescription`), separately — consistent with the P0b ADR's "phase-aware targets via `goal.prescription`, not here". P3 just makes the phase real and available.
- **Titration *planning*** (a course object with scheduled dose steps) — YAGNI; the dose log shows the actual progression.
- **Personalized appetite curve** fitted to logged pacing — Phase-3 AI.
- **Insights / Train Reta strings** (hardcoded phase prose in `data/insights.ts`/`train.ts`/`goals.ts`/`chat.ts`) stay frozen mock until Slice D.
- **Multiple medications in the UI** — the schema supports many (each dose FKs one medication), but the tab is tuned to the single Reta row for now; it becomes a list later with **no backend change**.

## 2. Architecture & data model (BE)

New feature package `feature/medication` (own bounded slice; cross-read by Fuel/Today like recipe→meal_item is cross-read by meal).

**`medication`** — the drug definition + its cycle config. Owned, soft-delete.
- `id uuid pk`, `created_by uuid`, `is_deleted`, timestamps.
- `name` (Retatrutide), `active_ingredient`, `route` (e.g. `subQ`), `cadence` (e.g. `weekly`), `default_dose numeric` + `dose_unit` (mg).
- **Cycle config** as a typed-jsonb `MedicationCycleJson` (`@JdbcTypeCode(SqlTypes.JSON)`, the ProvenanceEnvelope precedent): `cycleLengthDays` (7) + ordered `phases[]` `{ key: peak|stable|trough, fromDay, toDay, label }`. Per-medication (not global config) because a future drug has a different curve.
- `is_active boolean` (one active medication per user expected, but not enforced as a hard singleton).

**`medication_dose`** — one row per actual injection. Owned, soft-delete, the `run_session_log`/`meal_item` event-log shape.
- `id uuid pk`, `created_by uuid`, `is_deleted`, timestamps.
- `medication_id uuid` FK → `medication` **ON DELETE RESTRICT** (history must not vanish when the definition is edited; soft-delete the medication instead).
- `administered_at timestamptz` (the injection moment; time optional → defaults to date at 00:00 local, server-stamped like `MealService.applyHeader`).
- `administered_date date` — derived from `administered_at`, indexed with `created_by` for the "last dose" lookup.
- `dose numeric` + (reuse the medication's `dose_unit`), `note text` (e.g. injection site).

**Liquibase:** one changeset `{ts}_mezo-d94_create_medication.sql` (both tables, explicit `pk_/fk_/idx_/ck_` names per `liquibase_conventions`). **Seed:** demodata `@Profile("demodata")` Java loader creates the owner's Retatrutide medication + a recent Monday dose so the derived `retaDay` matches today's demo (≈3). `ResetDatabase` TRUNCATE list gains both tables; new `MedicationPopulator` / `MedicationDosePopulator`.

**Reta leaves the pantry:** the `pantry_item` `kind='med'` path is retired for Reta — the demodata seed puts Reta in `medication`, not `pantry_item`, and the Kamra no longer shows it. (Supplements/stim stay in `pantry_item`; only `med` migrates out.) The `ck_pantry_item_kind` `'med'` value can stay admissible for now but is unused; the P0b ADR records this.

## 3. Derivation — the one calculation

`MedicationCycleService.derive(userId, onDate)` → `MedicationCycleResponse { retaDay, phaseKey, phaseLabel, lastDoseAt, week[] }`:
- `lastDose` = newest `medication_dose.administered_date <= onDate` for the active medication.
- `retaDay` = `daysBetween(lastDose, onDate) + 1`, clamped to `1..cycleLengthDays` (a missed/late dose past the cycle length holds at the last day or shows a "túl régi beadás" state — decided in the plan).
- `phaseKey/Label` = the `phases[]` entry whose `fromDay..toDay` contains `retaDay`.
- `week[]` = the 7-cell cycle strip (replaces the static `retaWeek`).
- No dose ever → an empty/ghost cycle state (no fabricated `retaDay`), the honest-zero pattern (`mezo-0xl`).

## 4. API contract

New `api/feature/medication/medication.yml` (contract-first; merged → FE+BE types).
- `GET /api/medication` → the active `MedicationResponse` (definition + cycle config) **+ the derived `MedicationCycleResponse` + the recent `MedicationDoseResponse[]`** (one round-trip feeds the whole tab).
- `PUT /api/medication/{id}` → edit the definition / cycle config (`MedicationRequest`).
- `POST /api/medication/{id}/dose` → log an injection (`MedicationDoseRequest { administeredAt?, dose, note? }`, 201).
- `DELETE /api/medication/{id}/dose/{doseId}` → soft-delete a mis-entered dose (204).
- (`POST /api/medication` for creating a medication exists but is demodata-seeded in P3; the UI starts from the seeded Reta + edit.)

The derived `{ retaDay, phaseKey }` is **also folded into the existing Fuel day/timeline payload** later (P5) so the Mai/Terv views don't each call `/api/medication` — but in P3 the tab reads `/api/medication` directly and `useTodayScenario` composes the cycle.

## 5. Frontend

**Tab + routing:** add `Gyógyszer` to `FuelSubNav` + a `/fuel/gyogyszer` route → `FuelMedicationView`.

**`FuelMedicationView`** (the mockup, "A" spacious): medication card (name · route · cadence · current dose) → the **7-day cycle bar** (Peak/Stable/Trough, current day outlined) → a phase note ("3. nap · Stabil fázis · utolsó beadás 2 napja") → the **"Beadások" log** (date + dose rows, newest first) → **"＋ Új beadás"**. A small "szerkesztés" on the card opens the medication/cycle editor (rare).

**`LogDoseSheet`** (chamfer `Sheet`): `Dátum` (default today) · `Időpont` (optional) · `Dózis` (prefilled from the last dose) · `Jegyzet` (optional) → `useMedicationActions().logDose`.

**Hooks** (`frontend/src/data/medicationHooks.ts`, re-exported from `hooks.ts`):
- `useMedication()` → dual-mode `{ medication, cycle, doses }` via `useDualQuery` (`['medication']`: mock from a new `medication` seed in `data/`, real from `GET /api/medication`; `realEmpty` = no-medication ghost).
- `useMedicationActions()` → `{ logDose, removeDose, updateMedication }`: mock mutates the `['medication']` cache; real calls the endpoints then invalidates `['medication']` **and** `['today']`/`['fuelDay']` (the cycle feeds those).

**Broadcast swap (the highest-leverage change):** `useTodayScenario()` (`hooks.ts:18`) — `retaDay` derives from `useMedication().cycle.retaDay` in real mode; the `?retaDay=` URL override is preserved (mock + tests rely on it, `hooks.test.tsx`). Consumers unchanged: Today briefing, `RetaPhaseBar` (Mai), `RetaWeekStrip` (Terv, drop the hardcoded `currentDay={3}`).

## 6. Integration / broadcast (the "send it everywhere")

`useTodayScenario().retaDay` is the **single FE source** every Reta surface already reads — so the swap is localized:
- **Today** — briefing `retaDay` + the "Reta · Hétfő" anchor.
- **Fuel / Mai** — `RetaPhaseBar` (already reads `useTodayScenario().retaDay`).
- **Fuel / Terv** — `RetaWeekStrip` (replace hardcoded `currentDay={3}` with the derived day).
- **Calorie calc (NARROW, separate):** the phase is *available*; the phase→kcal-floor/appetite rule is applied on the meal-targets side (`NutritionTargetsProperties` + `goal.prescription`), not in this slice.
- **Insights / Train** — frozen mock prose until Slice D.

## 7. Error handling

House `error_handling` conventions: `SystemRuntimeErrorException` + `SystemMessage` codes. Ownership gate (404 for missing/foreign medication or dose). Validation: `dose` required + positive; `administeredAt` not in the future → `VALIDATION_INVALID_VALUE`. A `DELETE` of the last dose is allowed (the cycle falls back to the no-dose ghost state). Editing the cycle config validates `phases[]` cover `1..cycleLengthDays` contiguously.

## 8. Testing

- **BE (integration-first, Testcontainers/compose `mezo_test`):** `MedicationCycleServiceIT` — `retaDay`/phase for various last-dose offsets incl. day-1, mid-cycle, past-cycle-length, and no-dose; `MedicationApiIT` — log/delete dose, edit cycle, ownership 404, future-date reject; `MedicationDosePopulator`. AssertJ, populators, no mocks.
- **FE (both modes + build):** `FuelMedicationView` (card + cycle bar + log), `LogDoseSheet` (capture → `logDose`), and the **`useTodayScenario` derived-`retaDay`** test (real derives from the cycle; `?retaDay=` override still wins) — the regression guard that the broadcast didn't break Today/Mai/Terv.

## 9. Roadmap impact (record on build)

- **P0b ADR (`mezo-ut1`) is revised:** Reta is **first-class `medication` + `medication_dose`**, NOT a `pantry_item` row. The ADR records: pantry `kind='med'` retired for Reta; supplements/stim stay in `pantry_item`; `supplement_intake` (the P2 event table) covers supplement/stim adherence only — medication dosing is its own domain.
- **P3 (`mezo-d94`) is this slice** — the roadmap P3 brief updates from "Reta = data in pantry" to "first-class Gyógyszer tab + medication domain + broadcast".
- **P5 (timeline)** later folds the derived `{retaDay, phase}` into the Fuel day/timeline payload so views stop calling `/api/medication` individually.

## 10. Decisions locked

| # | Decision | Choice |
|---|---|---|
| 1 | Data model | **A — dose log** (events; cycle derived). No course/titration object. |
| 2 | Reta home | **First-class `medication` domain**; leaves `pantry_item`. |
| 3 | Cycle config | **Per-medication typed-jsonb** (`MedicationCycleJson`), not global config. |
| 4 | Multiple meds | Schema supports many; **UI single-Reta now**, list later (no BE change). |
| 5 | Calorie effect | **Narrow** — produce phase only; phase→kcal rule lives on meal-targets/`goal.prescription`. |
| 6 | `subQ` label | Keep (UI may soften to "bőr alá" — cosmetic, decided in the plan). |
| 7 | Broadcast | Via existing `useTodayScenario().retaDay`; `?retaDay=` override preserved. |
