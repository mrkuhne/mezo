# 0027 — Mesocycle template/run split, stamp-on-start

- **Status:** Accepted
- **Date:** 2026-08-17
- **Driver:** mezo-meyc.1 (epic `mezo-meyc`)

## Context

A `mesocycle` row was **plan and execution merged**: it carried the plan (days, exercise recipes,
phase curve, volume baseline) AND the run state (`startDate`/`endDate`/`currentWeek`,
`status ∈ {planned, active, archived}`, weekly volume-log mutations). Consequences: a mesocycle
could only be done **once** — closing (`POST .../{id}/close`) was a pure status flip to `archived`
with no way to run the same plan again; an archived run had **no persisted outcome** beyond a
demo-only `summary` string; and there was **no comparison** between runs, no history beyond the
library page's dimmed "Archív · N" card list.

Daniel's ask (brainstorm 2026-08-16, full design in
[`2026-08-16-mesocycle-history-design.md`](../superpowers/specs/2026-08-16-mesocycle-history-design.md)):
make mesocycles historical — a mesocycle can be done multiple times, each run's results must be
visible, and runs must be comparable. This ADR covers the **S1** foundation (`mezo-meyc.1`) that
the later report/AI/compare slices (S2–S4) build on; those slices are **planned, not yet built**.

## Decision

**Split the plan from the run into two entities, and stamp a run by copying the plan document —
never by mutating or referencing it live.**

- **`meso_template`** (new table + `MesoTemplateEntity`) is the reusable blueprint: plan metadata
  (`title`/`goal`/`weeks`/`split`/`style`/`phase_curve`) plus **`days jsonb`** (the day + exercise
  recipe plan, typed via `MesoDayJson`/`GymExerciseJson` records) and **`volume_per_muscle jsonb`**
  (the MEV/MAV/MRV baseline, typed via `VolumeBaselineJson`) — the `ProvenanceEnvelope` idiom
  (`@JdbcTypeCode(SqlTypes.JSON)` onto Java records), never `String`. A template has no dates, no
  `status`, no `currentWeek` — it is timeless and freely editable between runs.
- **`mesocycle`** (the run) gains `template_id UUID NULL` (nullable — legacy runs stay `null`) and
  `closed_at timestamptz NULL`. Every existing column/behavior (status values, single-active
  invariant, volume logs, workout instances, goal links, rollover, volume arc) is untouched — the
  run machinery never had to move, because the run **is** still the same `mesocycle` row every
  existing FK already points to.
- **Starting a run stamps the plan**, exactly like today's create did: `POST
  /api/train/meso-templates/{id}/start {startDate, status}` creates a fresh `mesocycle` row
  (metadata copied, `endDate`/`currentWeek`/`orderIndex` server-computed), materializes `days` →
  `workout_session` template rows + `exercise` rows, and — for an active start — `volume_per_muscle`
  → `muscle_group_volume_log` baseline rows. `TrainService.stampRun` is the ONE code path every
  start funnels through (`MesoTemplateService.start`).
- **`POST /api/train/mesocycles` (direct run create) is removed from the contract.** The planner
  now saves a template, then chains a `start` call — there is no other way to create a run.
- **Legacy bridge:** `POST /api/train/mesocycles/{id}/rerun` materializes a template out of a
  pre-split run's own rows (metadata + template days/exercises + volume-log landmarks, falling
  back to the baseline name "Örökölt kiindulás" when a row carries no provenance) the first time
  it's called, links it onto the run (`template_id`), and returns it — a second rerun of the same
  run is then a plain `templateId` lookup. This is what lets "Újrafuttatás" on a pre-existing
  archived run reach the same one `start` path a template-native run uses.
- **S3's event seam is part of this accepted design, but not built yet.** The deterministic close
  report (S2, `feature/train`) and the AI evaluation (S3, `feature/companion`) will couple through a
  published `MesocycleClosed(userId, mesocycleId)` event consumed `@Async` +
  `@TransactionalEventListener(AFTER_COMMIT)` — dictated by the ArchUnit cycle-free-slices rule
  (companion already depends on train via `TrainTools`, so train must never depend back). This ADR
  fixes that placement as the accepted shape for when S3 lands; nothing in `feature/train` publishes
  or expects the event yet.

## Consequences

- **Historical fidelity falls out by construction.** Every run owns the exact plan it actually ran
  — including any mid-run edits via the existing `replaceDayExercises` path — because the run's
  `workout_session`/`exercise` rows are its own copy, not a live reference to the template. A later
  template edit can never falsify a past run's history.
- **Zero migration of existing consumers.** Every FK, query, and feature that already pointed at
  `mesocycle` (companion tools, goal links, volume progression, the today/week agenda) keeps working
  unchanged — `template_id` is purely additive and nullable.
- **"Write back to template" is deliberately out of scope (YAGNI).** A mid-run edit only ever
  changes that run's own copy; template edits are a separate, explicit action on the template
  editor. If athletes want their edits to flow back, that's a future decision, not an implicit one.
- **Known deferred edges, accepted for S1:**
  - `POST .../rerun` on a run whose materialized template was later soft-deleted still returns that
    (now-invisible) `templateId`, and the subsequent `start` call 404s
    (`TRAIN_MESO_TEMPLATE_NOT_FOUND`) — there is no re-materialize-on-404 retry yet.
  - Every full template update (`PUT /api/train/meso-templates/{id}`) regenerates every exercise's
    server-side id — a client must not assume exercise ids are stable across saves.
  - **Close is still a bare `status=archived` flip** — `closed_at` exists as a column but nothing
    writes it yet; the report/AI close flow is S2/S3, not part of this slice.

## Alternatives considered

- **Full normalization** (a run references shared plan/day/exercise rows via versioned FKs instead
  of copying them). Rejected: honest history still needs per-run plan freezing to survive a later
  template edit, so the duplication returns anyway — on top of migrating every existing FK and
  consumer (companion tools, volume progression, goal links) onto the new shape.
- **Clone-with-lineage** (each re-run clones the previous run's `mesocycle` row and links it via a
  `previous_run_id` chain, no separate template entity). Rejected: there is no natural "canonical"
  plan to edit between runs — every edit would have to pick one arbitrary run in the chain as the
  editable head, and the plan/run distinction the rest of this design leans on (a template has no
  dates/status, a run has no independent "is this the template" question) disappears.
- **Simple re-activation** (allow `POST .../{id}/activate` on an archived run instead of a new
  entity). Rejected: reusing the same row for a second run destroys the first run's history the
  moment the second starts — the exact problem this epic exists to solve.
