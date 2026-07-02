# Fuel — Stack/Protocol + Water design (roadmap P0 + P1 + P2)

- **Date:** 2026-07-02
- **Status:** designed — scope + protocol-persistence chosen by Daniel in-session; the P0c-included
  and Mentés-CTA-deferred defaults were taken autonomously and await his review before P1/P2 code starts
- **Driving bd:** `mezo-ut1` (P0 ADRs) · `mezo-0z5` (P1 water) · `mezo-09g` (P2 Stack/Protocol)
- **Parent roadmap:** [`docs/superpowers/plans/2026-06-26-fuel-completion-roadmap.md`](../plans/2026-06-26-fuel-completion-roadmap.md) (epic `mezo-6r1`)
- **Living doc to update on ship:** [`docs/features/fuel.md`](../../features/fuel.md)

## 1. Scope & sequencing

Make the Fuel **Mai** and **Stack** pages honest (real, dual-mode) — the **Terv** page (roadmap P4)
is explicitly skipped this round, and the Mai merged **timeline** (P5, `mezo-9ys`) is the natural
NEXT etap: it builds on P2's `supplement_intake` and stays out of this scope.

Execution order (each its own `feat/` branch + bd issue):

1. **P0 — ADRs** (`mezo-ut1`): three short ADRs, no feature code. All three are written (P0c included
   so `mezo-ut1` closes whole): `0004` Train-schedule ownership, `0005` pantry_item supersedes
   food_item + `supplement_intake` FK, `0006` meal-score jsonb envelope.
2. **P1 — Water logging** (`mezo-0z5`, S): warm-up slice; makes the `MacroHero` water ring real.
3. **P2 — Stack/Protocol** (`mezo-09g`, L): the main course; first Fuel-owned backend package +
   `api/feature/fuel/fuel.yml`.

Decisions taken in the brainstorm (2026-07-02, with Daniel):

- **Scope** = P0 + P1 + P2 (P5 later; P6 Kamra-import not now; P4 Terv skipped).
- **Protocol persistence = selection + version only** — the backend stores the chosen
  `pantry_item` ids + version metadata; slots are recomputed by the FE `buildProtocol`
  (deterministic). No slot-snapshot jsonb. Trade-off accepted: protocol history is not frozen —
  a later `buildProtocol` change re-renders old versions' slots.
- **"Mentés protokollként" CTA → deferred** (`· hamarosan` disabled state, the RecipeDetail
  precedent). Only **"Bekapcsolás · ma"** becomes a real write in P2. No draft/saved versions.

## 2. P1 — Water logging (mezo-0z5)

**Problem.** `FuelDayService` sets `consumed.water = targets.water` — the Mai water ring is always 100%.

**Backend.**
- New owned table `water_log` (smallest single-row aggregate; weight/sleep-log precedent):
  `id uuid PK`, `created_by` FK → `app_user`, `is_deleted`, `created_at`, `log_date date`,
  `amount_ml integer > 0` (CHECK). Migration `{ts}_mezo-0z5_create_water_log.sql`; explicit
  constraint names per `liquibase_conventions.md`.
- `WaterLogEntity` + repository + service; `FuelDayService.consumed.water` = Σ `amount_ml` for the day.
- Contract: extend `api/feature/meal/meal.yml` — `POST /api/water-log` (`{date?, amountMl}` → 201)
  and `DELETE /api/water-log/{id}` (204, soft-delete undo). The day rollup already flows through
  `FuelDayResponse.consumed.water` — no read-shape change.
- ITs: `WaterLogApiIT` + `FuelDayServiceIT` water case; `WaterLogPopulator`; `ResetDatabase` TRUNCATE + `water_log`.

**Frontend.**
- `useWaterActions.logWater(amountMl)` in `data/fuel/fuelHooks.ts` (mock: `setQueryData` on
  `['fuelDay', date]` incrementing `consumed.water`; real: POST + invalidate `['fuelDay']`).
- `+250 / +500 ml` chips on `MacroHero` (Mai). Undo not surfaced in v1 UI (endpoint exists).
- Stop the mock `recomputeConsumed` forcing `water = targets.water`.
- Hook signatures unchanged (`useFuelDay` already carries `consumed.water`).

**Out:** goal/Reta-aware water targets (config constant stays).

## 3. P2 — Stack/Protocol (mezo-09g)

**Problem.** The Stack page is 100% mock: `buildProtocol` is deterministic FE logic but the
"Bekapcsolás · ma" CTA is an inert toast, nothing records when a supplement is actually taken,
and the Mai protocol-meta row (`Stack · v{n}`) reads a static const.

### 3.1 Contract (new `api/feature/fuel/fuel.yml` — first Fuel-owned fragment)

- `GET /api/fuel/protocol` → the **active** protocol:
  `{ id, version, builtAt, status, confidence, lastReplanReason?, selectedPantryItemIds[], history[] }`
  where `history[]` is a short `{version, builtAt}` list (newest first). Honest-empty: no protocol
  yet → 200 with a null/empty envelope (FE falls back to default selection), never a fabricated v1.
- `POST /api/fuel/protocol` (`{ selectedPantryItemIds[], reason? }`) → creates version `max+1` as
  `active`, previous active → `superseded`; returns the full protocol envelope. 201.
- `POST /api/fuel/intake` (`{ pantryItemId, takenAt?, slotKey?, dose? }`) → 201 `IntakeResponse`.
  Null `takenAt` defaults server-side to now (the `medication_dose` precedent).
- `DELETE /api/fuel/intake/{id}` → 204 (soft-delete undo).
- `GET /api/fuel/intake/{date}` → the day's intake rows (feeds `taken` state now; the P5 timeline
  reuses this read).

### 3.2 Backend (`feature/fuel` package)

- **`protocol`** table: `id`, `created_by`, `is_deleted`, `created_at`, `version integer`,
  `built_at timestamptz`, `status text CHECK in ('active','superseded')`, `confidence numeric`,
  `last_replan_reason text`. One active per user (partial unique index on
  `(created_by) WHERE status='active' AND NOT is_deleted`).
- **`protocol_item`** join table (normalized, no jsonb id-array): `protocol_id` FK CASCADE,
  `pantry_item_id` FK → `pantry_item` **RESTRICT**, `item_order`.
- **`supplement_intake`** append-only ledger (the `medication_dose` precedent): `id`, `created_by`,
  `is_deleted`, `created_at`, `pantry_item_id` FK RESTRICT, `taken_at timestamptz`,
  `taken_date date` (derived day key, indexed with `created_by`), `slot_key text?`,
  `dose text?` (snapshot at intake time), `note text?`.
- `ProtocolService` (activate = supersede current + insert v+1), `IntakeService`.
- Config per `configuration_conventions.md`: `mezo.fuel.*` `@Validated` properties record —
  `protocol-default-confidence` (the hardcoded `conf 0.86`), `kcal-floor` (the hardcoded 2500).
- demodata: Java `@Profile("demodata")` seed — no protocol row (honest-empty start); optionally a
  demofixtures protocol for the demo profile.
- ITs: `ProtocolApiIT`, `IntakeApiIT` (+ service ITs), `ProtocolPopulator`/`SupplementIntakePopulator`,
  `ResetDatabase` TRUNCATE + the three tables.

### 3.3 Frontend (hook signatures stable — the Phase-2 contract)

- New `data/fuel/fuelApi.ts` (protocol + intake calls, `toRequest`/`fromResponse` mapping).
- `useStack()` → dual-mode by **composition** (single source of truth): `stash` keeps coming from
  the pantry (`usePantry()` — already real), `taken` derives from a `['fuelIntake', today]` query
  (real: `GET /api/fuel/intake/{date}`; mock: seed). Return shape `{ stash }` unchanged.
- `useProtocol()` → dual-mode `['protocol']` query (mock seed `protocol` const via `initialData`;
  real `GET /api/fuel/protocol`, honest-empty while unresolved).
- New `useStackActions { logIntake, undoIntake }`, `useProtocolActions { applyProtocol }` —
  mock mutates caches via `setQueryData`, real POST/DELETE + invalidate
  (`['fuelIntake']`, `['protocol']`; intake also `['fuelDay']` once P5 joins them).
- `FuelStackPage`:
  - initial `selectedIds` ← the **active protocol's selection** (fallback: all non-medication
    stash items when no protocol exists — the current default);
  - **"Bekapcsolás · ma"** → `applyProtocol(selectedIds)`; toast shows the **real** returned version;
  - **"Mentés protokollként"** → disabled `· hamarosan`;
  - `ProtocolSlot` item rows become tap-to-toggle intake (tap → `logIntake`; tap again →
    `undoIntake` of today's matching row);
  - "Mit hozzáadnék" recommendations: real mode `[]` (P8) → section hidden when empty.
- Mai page protocol-meta row (`Stack · v{protocol.version} · {builtAt}`) now reads the real protocol.
- **Folds in `mezo-4nu` #1–2:** decouple the Stack page from real `useGoal()`/`useProfile()`
  fetches (only the meso title/week context cell needs them).

**Out/deferred (unchanged from roadmap):** learned/personalized timing, real Replan, stack
recommendations → P8; weekly supplement-adherence matrix → P4/P2-later (its consumer is the
skipped Terv page); the Mai timeline supplement pips → P5. The context cells' "Heti load 5+4" /
"Alvás 7.5h" literals stay static this round (P4/P8 feeds them later).

## 4. Testing & gates

- Backend: `./mvnw clean test` (compose `mezo_test` up) — integration-first, AssertJ, populators.
- Frontend: `pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green;
  mock/real parity for every swapped hook (the `useWeight` pattern).
- Docs: update `docs/features/fuel.md` (§2 Mai/Stack, §3, §4, §9) + the completion-roadmap plan
  (mark P0/P1/P2 shipped) + `docs/milestones/roadmap.md`; `node scripts/lint-docs.mjs` clean.

## 5. Open items (accepted, not blockers)

- Protocol history is un-frozen by design (selection-only persistence) — revisit only if a real
  audit need appears.
- `GET /api/fuel/intake/{date}` vs folding intakes into `FuelDayResponse`: kept separate to keep
  `meal.yml` stable; P5 may compose them server-side.
- Water undo UI (endpoint ships, no surface) — add when a mis-tap actually hurts.
