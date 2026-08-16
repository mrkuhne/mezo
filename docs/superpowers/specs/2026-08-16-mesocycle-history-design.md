# Mesocycle history — template/run split, run reports, AI review, compare — design

**Date:** 2026-08-16 · **Driving issue:** `mezo-meyc` (epic; slices `mezo-meyc.1`–`.4`) ·
**Status:** approved by Daniel (brainstorm 2026-08-16)

## Context

Today a `mesocycle` row is **plan and execution merged**: it carries the plan (days, exercise
recipes, phase curve, volume baseline) AND the run state (`startDate`/`endDate`/`currentWeek`,
`status ∈ {planned, active, archived}`, weekly volume-log mutations). Consequences:

- A mesocycle can only be done **once** — closing (`POST .../{id}/close`) is a pure status flip
  to `archived` with no way to run the same plan again.
- An archived run has **no persisted outcome**: `mesocycle.summary` exists but is written only
  by demo seed; no `closed_at`, no adherence/strength/volume rollup, no completion stats.
- There is **no comparison** between runs and no history surface beyond the library page's
  dimmed "Archív · N" card list.

Daniel's ask: make mesocycles historical — a mesocycle can be done multiple times, each run's
results must be visible, and runs must be comparable.

## Decisions (brainstorm, in order)

1. **Template/run split** — over clone-with-lineage and simple re-activation. An explicit
   template entity with a run history under it.
2. **A closed run's "results" are comprehensive:** volume + adherence, strength progression,
   records/medals, a free-text self-evaluation, **plus** a cross-domain dry context snapshot
   (sleep, fuel/macros, daily check-ins, weight, other sport/running load during the run
   window) **and a persisted long-form AI evaluation** generated over all of it.
3. **Any two runs are comparable** — same-template comparison is the typical case but not a
   constraint; template identity is a filter/badge, not a wall.
4. **AI evaluation is generated automatically at close and is regenerable** from the report
   page.
5. **Implementation strategy A — "stamp-on-start"** (over full normalization): the template is
   a new entity holding the plan as a document; starting a run stamps the plan into a
   `mesocycle` row exactly as create works today. The existing run machinery (weekly volume
   rollover, volume arc, prescriptions, goal links, companion tools) is untouched because the
   run IS the `mesocycle` row every existing FK already points to. Historical fidelity falls
   out by construction: every run owns the plan it actually ran, including mid-run edits; later
   template edits can never falsify the past. Full normalization was rejected because honest
   history would need per-run plan freezing anyway (the duplication returns, plus versioning),
   on top of migrating every FK and consumer.

## §1 Domain model, lifecycle, migration (S1 — `mezo-meyc.1`)

### `mesocycle_template` (new table + entity)

House rules: UUID PK (`gen_random_uuid()`), `created_by` via `OwnedEntity`, soft delete
(`@SQLDelete`/`@SQLRestriction`), explicit constraint names.

- Plan metadata: `title`, `short_title`, `goal`, `weeks`, `split`, `style`,
  `phase_curve text[]` (mapped `List<String>` for dirty-checking, same trick as the run),
  `notes`.
- **`days jsonb`** — the day + exercise-recipe plan document: the `MesoDayInput[]` contract
  shape persisted as a **typed** embedded object (`@JdbcTypeCode(SqlTypes.JSON)` onto Java
  records — the `ProvenanceEnvelope` idiom, never `String`). Template days are never referenced
  by workout instances, so no `workout_session` rows are needed for templates and that table's
  semantics stay untouched.
- **`volume_per_muscle jsonb`** — the per-muscle MEV/MAV/MRV baseline (the `VolumeBaseline`
  shape keyed by muscle), stamped into `muscle_group_volume_log` rows at run start.
- No dates, no `status`, no `currentWeek` — a template is timeless and freely editable between
  runs.

### `mesocycle` (the run — two new columns)

- `template_id UUID NULL` FK → `mesocycle_template` (`fk_mesocycle_template`), nullable —
  legacy runs live on with `null`. ON DELETE no action (template is soft-deleted anyway).
- `closed_at timestamptz NULL` — the close moment (today it is lost).
- Everything else unchanged: status values, single-active invariant, volume logs, workout
  instances, goal links, rollover, volume arc.

### Lifecycle

- **Planner (wizard)** now saves a **template**. Terminal-step buttons become
  „Mentés sablonként" / „Mentés + indítás" (template + immediately stamped active run — two
  sequential FE calls: create template, then start).
- **Start (stamp)** — `POST /api/train/meso-templates/{id}/start` `{startDate, status:
  active|planned}`: creates a `mesocycle` row (metadata copied; `endDate`, `currentWeek`,
  `orderIndex` server-computed exactly as today's create), materializes `days` jsonb →
  `workout_session` template rows + `exercise` rows (unknown `catalogId` → 400, as today), and
  volume baseline → `muscle_group_volume_log` rows with a baseline `ProvenanceEnvelope`.
  Starting as active archives other actives (existing rule).
- **Mid-run edits** modify the run's own copy via the existing `replaceDayExercises` path — the
  history preserves the plan actually run. ("Write back to template" is deferred, YAGNI.)
- **Re-run:** from a template ("Indítás"), or from a closed run ("Újrafuttatás") —
  `POST /api/train/mesocycles/{id}/rerun` **materializes a template** from a legacy run's rows
  when `template_id` is null and returns `{templateId}`; the FE then opens the standard start
  sheet on that template (start-date pick) → the one shared `start` call. Stamping has exactly
  one code path.
- **Close** grows into a real closure flow (§2).
- `POST /api/train/mesocycles` (direct run create) is **removed from the contract** — the
  planner is its only caller and moves to template create + start. Demo seed uses services
  directly and is updated in place.

### Migration

DDL only: one new table + two nullable columns. No data movement — every existing meso row is
reinterpreted as a run (`template_id null`); planned mesos stay planned runs and activate as
today.

## §2 Run report + close flow (S2 — `mezo-meyc.2`)

### `mesocycle_report` (new 1:1 table + entity)

`mesocycle_id UNIQUE` FK → `mesocycle` CASCADE (`fk_mesocycle_report_mesocycle`,
`uq_mesocycle_report_mesocycle`), `created_by`, soft delete.

- **`report jsonb`** — typed report document, computed and frozen at close (below).
- **`context jsonb`** — typed cross-domain context snapshot, written by the async companion
  listener (§3); null until it lands.
- **`self_eval text`** — the athlete's free-text evaluation (takes over the role of the dead
  `mesocycle.summary`; the old column is left in place for legacy reads, nothing new writes
  it).
- **`ai_eval text`**, **`ai_eval_status text`** (`pending|ready|failed`,
  `ck_mesocycle_report_ai_status`), **`ai_eval_generated_at timestamptz`**.

Separate table so the meso row stays lean, the report cascades away with its run, and
regeneration writes are isolated.

### `report` jsonb content (deterministic, train-owned)

1. **Adherence:** planned sessions (template gym days × weeks elapsed at close, week from the
   shared `MesoWeeks.clampWeek`), completed meso-origin instances of this run in
   `[startDate, closedAt]`, weeks-with-≥1-completed / planned weeks, completion %.
2. **Volume:** the volume arc frozen — the existing `VolumeArcService.arc(id)` output persisted
   verbatim (per-muscle weekly planned/actual + phase curve), so the report survives any later
   engine change.
3. **Strength:** per exercise identity (catalog id, else exact name — the
   `ExerciseHistoryResolver` idiom) trained in this run's completed instances: best working set
   of the identity's first meso-week vs its last (e1RM via Epley `w×(1+reps/30)`), absolute +
   percent delta, sorted by gain; FE shows the top jumps.
4. **Records/medals:** count + top entries earned inside the run window, frozen at close via
   the existing derive-and-replay medal evaluator.

### Close flow

The builder's „Meso lezárása" button opens a **close sheet**: a short "what gets closed"
summary + optional self-eval textarea → confirm → `POST .../close` with new optional body
`{selfEval?}`. Server (in one transaction): `status=archived`, `closed_at=now`, compute +
persist the deterministic report, set `ai_eval_status=pending`, publish `MesocycleClosed`
(AFTER_COMMIT listener picks it up, §3). FE redirects to the **report page**, where the AI
section refreshes from pending to ready. Close stays idempotent (re-close of an archived run is
a no-op and does not recompute).

**Legacy backfill:** an archived run with no report shows a „Riport generálása" button — the
same regenerate path (§3) computes it after the fact; `closed_at` falls back to `endDate` for
window math when null. This gives all existing archived mesos a report retroactively.

## §3 Cross-domain context + AI evaluation (S3 — `mezo-meyc.3`)

### Placement (dictated by the ArchUnit cycle-free-slices rule)

companion already depends on train (`TrainTools` et al.), so train must never depend back on
companion. Therefore:

- **Deterministic report** (§2) lives in `feature/train` (`MesocycleReportService`), computed
  inside the close transaction.
- **Context gathering + AI evaluation** live in `feature/companion`
  (`MesoReviewGenerator` + `MesoReviewListener`) — where cross-domain reads are already
  sanctioned.
- Coupling is **event-based**, the established pattern (`ChatTurnCompleted` →
  `FactExtractionListener`): train publishes `MesocycleClosed(userId, mesocycleId)` (record
  lives in train), companion consumes it with `@Async` +
  `@TransactionalEventListener(phase = AFTER_COMMIT)`.

### Context snapshot (`context` jsonb; fast DB reads, exists even if the LLM fails)

Built on the existing `MetricSeriesService.series(userId, key, from, to)` per-day scalars,
**bucketed into meso weeks W1..Wn** (via `MesoWeeks.weekOf`) so two runs of different lengths
align week-by-week in the comparison:

- **Sleep:** weekly avg duration + quality, run average, trend (`SLEEP_DURATION_H`,
  `SLEEP_QUALITY`).
- **Fuel:** daily kcal vs target, coverage (days with logged meals), water avg (`DAILY_KCAL`,
  `DAILY_WATER_ML` + targets from the existing nutrition-targets source).
- **Check-ins:** weekly energy + stress averages (`CHECKIN_ENERGY`, `CHECKIN_STRESS`).
- **Weight:** weekly + cumulative change over the run (`WEIGHT_DELTA_KG`).
- **Other load:** sport minutes + session counts, run sessions + RPE, gym RPE average
  (`SPORT_LOAD_MIN`, `TRAINING_RPE`, sport/run session repositories).

### `MesoReviewGenerator` (companion, one-shot smart-tier)

The proven one-shot generator shape (`MemoirGenerator`/`ChallengeGenerator`): idempotency check
(only runs when `ai_eval_status=pending`) → gather (frozen train report + context snapshot +
run-window daily summaries/patterns where available) → **one `completeSmart` call** (Hungarian
prompt, ADR 0010 tone: non-judgmental, pattern-focused) → persist `ai_eval` +
`ready`/`failed` + `ai_eval_generated_at`. Wrapped in
`LlmCallContext("meso_review", "generate")`; a public `MESO_REVIEW_MARKER` prompt prefix
mirrored in `FakeCompanionLlm` for tests. Feature switch:
`mezo.feature.meso-review.enabled` (default on) via a `MesoReviewGate` marker bean
(`FeaturesConfiguration` constant, `@ConditionalOnProperty`). Switch off ⇒ the listener still
writes the context snapshot but skips the LLM entirely, leaving `ai_eval_status = pending`;
the report response carries `aiEvalEnabled: false` and the FE hides the AI section instead of
polling — no eternal spinner.

### Regenerate

`POST /api/train/mesocycles/{id}/report/regenerate` → recomputes the deterministic report,
resets `ai_eval_status=pending`, republishes the event, returns **202**; the FE polls the
report until `ready`. Guard: **archived runs only** (an open/planned run has no report —
409 `TRAIN_MESO_NOT_CLOSED`). A regenerate while one is already `pending` is a no-op 202 (no
duplicate LLM call). This same path serves the legacy backfill (§2).

### Failure path

If the LLM call dies: status `failed`, dry report + context stay intact, report page shows
„Újrapróbálás". The close itself can never fail because of AI (AFTER_COMMIT — the close is
already durable).

## §4 UI surfaces (S1/S2/S3/S4)

- **Library** (`/train/mesocycles`, restructured, S1): **Sablonok** (cards: title, goal,
  split, weeks, „n× futtatva" badge; actions Szerkesztés / Indítás; the „+ Új" CTA opens the
  planner which now saves templates) → **Aktív futam** hero (as today) → **Tervezett** →
  **Történet** (closed runs, newest first; cards carry key results — adherence %, top strength
  jump — once S2/S4 land; tap → report page). History header gains an „Összevetés" mode (S4):
  select two runs → compare view.
- **Report page** (new full-screen sibling route `/train/mesocycles/:id/report`,
  `MesoReportPage`, S2/S3): header (title, dates, template link) → adherence block → frozen
  volume arc (reusing `VolumeArcChart`) → strength top list → records/medals → context block
  (weekly sleep/fuel/check-in/weight/other-sport cards, S3) → self-eval → AI evaluation
  (pending/ready/failed+retry, S3) → „Újrafuttatás" CTA. Archived runs without a report show
  „Riport generálása".
- **Compare view** (new `/train/mesocycles/compare?a=&b=`, `MesoComparePage`, S4): two runs in
  columns — adherence, per-muscle volume aligned W1..Wn, **strength deltas on shared exercise
  identities** (the heart of the comparison), context averages. No dedicated endpoint: the FE
  fetches two reports and composes client-side (YAGNI).
- **Builder/planner:** the builder remains the run's (active/planned); opening an archived run
  routes to its report page. The template editor is a new route
  (`/train/mesocycles/templates/:id`) driving the same shared `MesoEditor` on template data.
  Planner terminal-step save buttons relabeled (template / template + start).

## §5 API contract (contract-first, `api/feature/train/train.yml`)

| Endpoint | Purpose |
|---|---|
| `GET /api/train/meso-templates` | template list (with run count) |
| `POST /api/train/meso-templates` | create (planner) |
| `PUT /api/train/meso-templates/{id}` | update (template editor) |
| `DELETE /api/train/meso-templates/{id}` | soft delete (runs + reports untouched) |
| `POST /api/train/meso-templates/{id}/start` | stamp → new run `{startDate, status: active\|planned}` |
| `POST /api/train/mesocycles/{id}/rerun` | legacy run: materialize template if missing + return start target |
| `POST /api/train/mesocycles/{id}/close` | **extended:** optional body `{selfEval?}` |
| `GET /api/train/mesocycles/{id}/report` | full report (deterministic + context + AI + status + `aiEvalEnabled`) |
| `POST /api/train/mesocycles/{id}/report/regenerate` | 202, pending → async regeneration |
| ~~`POST /api/train/mesocycles`~~ | removed (planner moves to template create + start) |

`MesocycleResponse` gains `templateId?`, `closedAt?`, `hasReport`. New DTO families:
`MesoTemplateResponse`/`MesoTemplateUpsertRequest`/`MesoTemplateStartRequest`,
`MesocycleReportResponse` (adherence block, the reused `MesocycleVolumeArcResponse` shape,
`StrengthDelta[]`, records block, `MesoContextWeek[]` + totals, AI fields). FE: new hooks
(`useMesoTemplates`, `useMesoReport`) under `data/train/`, barrel-reexported from
`@/data/hooks`, dual-mode (mock serves template + report fixtures, writes no-op, AI status
`ready` in mock).

## §6 Error handling

Owner-scoped everywhere (foreign/missing → 404 with `SystemMessage` codes). Close idempotent;
regenerate during pending → no-op 202; start-as-active archives other actives; template soft
delete leaves runs + reports intact; AI failure never affects the close; switched-off AI is an
explicit `aiEvalEnabled=false`, never an eternal spinner.

## §7 Testing

- **Backend ITs** (house rules: `ApiIntegrationTest`, populators, no mocks):
  `MesoTemplateIT` (CRUD, ownership, stamp correctness — days/exercises/volume rows copied,
  single-active invariant, planned start), `MesocycleCloseReportIT` (report math on known
  populated data — adherence/strength/records —, idempotent close, selfEval, legacy rerun +
  backfill), `MesoReviewGeneratorIT` (event → `FakeCompanionLlm` marker → ready; LLM failure →
  failed with dry context intact; regenerate; switch-off). New tables → `ResetDatabase`
  TRUNCATE list; new `MesoTemplatePopulator`; reports created via the live path.
- **FE:** vitest in both modes + MSW handlers for every new endpoint; report page's three AI
  states; compare composition; library restructure; planner relabel. Visual goldens regenerated
  for touched pages.
- Locally only focused tests; the full suite is the CI self-PR gate.

## §8 Slices

| Slice | bd | Scope |
|---|---|---|
| S1 | `mezo-meyc.1` | template/run model: DDL, template CRUD + start/rerun, planner/library/template-editor FE. Close stays as-is. |
| S2 | `mezo-meyc.2` | deterministic close report: report table, close extension (selfEval, closed_at), report math, report page (no AI), legacy „Riport generálása". |
| S3 | `mezo-meyc.3` | context + AI: event, companion listener, context buckets, `MesoReviewGenerator`, regenerate, report page AI/context sections. |
| S4 | `mezo-meyc.4` | compare view + history selection + key results on history cards. |

Docs per slice: `train.md` (+ `companion.md` at S3), an ADR for the template/run-history model
(stamp-on-start decision + arch placement), roadmap update.

## Non-goals / deferred

- „Write back to template" from a run's mid-cycle edits.
- Cross-template aggregate analytics (only pairwise compare ships now).
- Any change to the volume-progression/prescription engines.
- Auto-close at `endDate` (close remains manual; `mezo-6pi` currentWeek auto-advance stays a
  separate issue).
