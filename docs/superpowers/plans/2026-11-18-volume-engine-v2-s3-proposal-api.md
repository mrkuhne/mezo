# Volume engine v2 — S3: the weekly proposal's API and manual mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The weekly proposal becomes something the phone can read and answer: one read returns this week's proposal
(per-muscle cards, one line per exercise change — sets, weight or reps — each with its reasons), one write takes
per-exercise decisions or "accept all / the rest stays". A `manual` mode keeps the proposal waiting for those decisions
instead of applying it; `auto` stays the server default (owner decision #5). A tier or sport change mid-run raises
its own proposal at once (defect 9). A "kept" weight/reps line pins that exercise to last week's load for the week.

**Architecture:** `WeekProposalService` keeps generation; it gains a stored per-group outcome (`groups` jsonb), load
lines from a new `LoadLinePreview` (it asks `SetRecommendationService` exactly what `getToday` will prescribe), a
lifecycle (`pending → applied | expired | superseded`, `auto_applied` unchanged) and decision-time application. A new
`WeekProposalDecisionService` applies decisions; `WeekProposalQueryService` serves the read (generating if due, as
`getToday` does). `WorkoutService.getToday` reads this week's kept load lines and prescribes those exercises
hold-only (`ProgressionDecider.capAtHold`). `TrainService.updateMusclePriorities` raises a `tier_change` proposal for
groups whose band changed and now sit outside it. No web UI changes.

**Tech Stack:** Java 21, Spring Boot, JPA/Hibernate, Liquibase (`1.1.0/`), PostgreSQL, OpenAPI contract-first,
JUnit 5 + Testcontainers.

**Spec:** `docs/superpowers/specs/2026-11-17-train-volume-engine-v2-design.md` §6.4 (lines, load lines, applying,
manual mode, reasons), §6.5 (tier change, supersede), §6.6 (the two operations), §6.7 (what the review screen shows),
§9 slice 3, §12 (as built — the truth where it differs). Folds in `mezo-r36n9.75`. Issue: `mezo-r36n9.78`.
Approved screen: branch `spike/boop-blokk-epito`, `ios/Boop/EdzesTervDemo/BlokkDemoModel.swift` (`DemoChange`,
`reviewMuscles`, `quietMuscles`, `decide`, `decideAll`, the summary card).

## What the screen needs, and where the API carries it

| Screen element (§6.7, demo) | Field |
|---|---|
| Entrance card: *Átnézem* / *Elfogadom átnézés nélkül* | `GET …/week-proposals` (status `pending`, `mode`) · `POST …/decisions {acceptRest: true}` |
| One card per muscle with changes, in body order | `muscles[]` with `lineCount > 0` (client orders) |
| Tile: kind mark, day pill, kind pill, `from → to` | line `kind` (`sets\|weight\|reps`), `dayIndex`, `dayName`, `from`, `to` (number; kg for weight) |
| Reasons as pills | line `reasons[]` (contract enum; Hungarian wording is the client's) |
| Per-tile accept / keep | `POST …/decisions {decisions: [{lineId, decision}]}`; line `decision` |
| Card-level "accept all" / "the rest stays" | the same call with that muscle's undecided line ids |
| "N izom marad, ahol volt" card | `muscles[]` with `lineCount = 0` and their `reasons[]` (why it holds: `tier_maintain`, `sets_missed`, `at_ceiling` …) |
| Summary: ring, stat tiles, per-muscle result, where changes land | `muscles[].setsBefore/setsAfter`, lines by `kind` and `dayIndex`, counts derived client-side |

Owner decision #8 (no per-muscle weekly total on the weekly card) is a client rule; the API carries the numbers for
the summary card.

## Global Constraints

- **`auto` stays the default** (`mezo.volume.weekly-review.mode: auto`). Production behaviour for the owner's run is
  unchanged except: (a) weight/reps lines now appear in the stored proposal (accepted, no write), (b) a tier/sport
  change on a run applies a `tier_change` proposal at once (spec §6.5). The per-user switch is the Boop slice's.
- Every contract change is **additive**: two new operations, new schemas, new error codes. No response changes shape.
- **Nothing is force-decided** in manual mode: opening a workout never decides; an undecided line stays unapplied;
  a pending proposal expires at the next week boundary (its undecided lines simply never happen).
- **Load lines never write.** Accepting one changes nothing (read-time prescription already does it); keeping one
  pins that exercise for that week to last week's reference (hold-only). Load lines are a preview: the session's
  real prescription may differ if he logs the exercise again before the week's first session of it.
- A set line is applied **at decision time**, only while the row still holds its `from` (else it is recorded `kept`
  and nothing is written — his own edit since the proposal stands). Every apply re-syncs the ledger.
- Tier-change proposals touch only groups whose **band changed** in that request (tier or sport flag) and now sit
  outside it — never a group he did not touch (the owner's biceps sits above its band by his own choice, §6.4).
- The weekly engine and the pin must never block `getToday` (failure → logged, served unpinned / unchanged).
- Tunables in `VolumeProperties` only if new ones appear (none planned).
- Hot spots shared with T2 (`mezo-r36n9.80`): `train.yml` + `openapi.yml` + `merge.yml`, the 1.1.0 master,
  `WeekProposalService`, `SetRecommendationService`. Agreed by bd comments on both issues; contract and Liquibase in
  late isolated commits; first to merge wins, the other rebases and regenerates `docs/CODEMAP.md`.
- ArchUnit: no raw generic exceptions outside techcore (`SystemRuntimeErrorException` + `SystemMessage`), no
  `runner` layer, layer subpackages enforced.

## Review Focus

- A decision on a closed proposal, a stale line, a double submit, `acceptRest` + `keepRest` together.
- Manual mode across a deload: the deload proposal partly accepted, expired, then the week after (`.75` #1).
- The week after a mid-block deload steps instead of holding when every halved set was done (`.75` #2).
- Auto mode on the owner's real shape: proposal stored with load lines, amounts as before.
- Tier change: only touched groups, supersede, auto applies at once, manual waits.
- `getToday` pin: kept load line → hold; accepted / undecided → normal; another week → normal; a re-minted row
  (day edit) still pinned by identity.

## File structure

| File | Change |
|---|---|
| `api/feature/train/train.yml`, `api/openapi.yml`, `api/generate/merge.yml` | `WeekProposal`, `WeekProposalLine`, `WeekProposalMuscle`, `WeekProposalDecisionRequest`, reason/kind/status enums; the two operations |
| `db/changelog/1.1.0/script/202611181400_mezo-r36n9.78_week_proposal_groups.sql` + master | `meso_week_proposal.groups jsonb` (nullable) |
| `entity/MesoWeekProposalEntity`, `entity/json/WeekProposalLineJson`, new `entity/json/WeekProposalGroupJson` | `groups`; line `dayName`, `fromKg`, `toKg` |
| `service/VolumeDecider` | input `plannedLastWeek` (the sets-missed basis) |
| `service/WeekProposalService` | groups, load lines, lifecycle (expire, manual stamp), restore lookup + consumption, shared apply helpers |
| new `service/LoadLinePreview` | weight/reps lines from `SetRecommendationService` |
| new `service/WeekProposalDecisionService`, `service/WeekProposalQueryService`, `mapper` + controller handlers | the two operations |
| `service/WorkoutService` | the weekly pin (kept load line → hold-only) |
| `service/TrainService` | tier-change proposal on `updateMusclePriorities` |
| ITs under `feature/train/service/` and `feature/train/` | per task |
| `docs/features/train.md`, spec §12 "S3 as built", `docs/boop-handbook/07-edzes/05-heti-volumen.md`, `docs/CODEMAP.md` | docs |

### Task 1: The contract

- [ ] `GET /api/train/mesocycles/{id}/week-proposals` → `WeekProposal[]` (200; 404 when the run is not his; `[]`
  when the run is not active, the gate is off, or nothing exists). `POST …/week-proposals/{proposalId}/decisions`
  `WeekProposalDecisionRequest {decisions?: [{lineId, decision: accepted|kept}], acceptRest?, keepRest?}` →
  `WeekProposal`. Errors: `TRAIN_WEEK_PROPOSAL_NOT_FOUND` 404, `TRAIN_WEEK_PROPOSAL_CLOSED` 409,
  `TRAIN_WEEK_PROPOSAL_DECISION_INVALID` 400 (unknown line id, both rest flags, a decided line asked to change).
- [ ] `WeekProposal {id, mesocycleId, week, kind: weekly|tier_change, status: pending|applied|auto_applied|expired|superseded, mode: auto|manual, createdAt, decidedAt?, lines[], muscles[]}`.
  `WeekProposalLine {id, exerciseId, exerciseName, dayIndex, dayName?, muscleGroup, kind: sets|weight|reps, from: number, to: number, reasons: WeekProposalReason[], decision?: accepted|kept}`.
  `WeekProposalMuscle {muscle, tier, bandLow?, bandHigh?, sportAdjusted, setsBefore, setsAfter, lineCount, reasons[]}`.
  `WeekProposalReason` enum = the 15 spec codes + the shipped `joint_pain`, `soreness`, `at_ceiling`,
  `deload_restore`, `stalled`, + `tier_change`.
- [ ] Regenerate, contract drift check green; controller stubs not needed (handlers land in Task 5 in the same
  branch — commit order contract → handlers is fine because the build compiles generated interfaces only once
  implemented; if the generator forces an implementation, land Task 1 and 5 in one commit).

### Task 2: Stored outcomes, decider basis (`.75` #2), line fields

- [ ] Liquibase script + master entry: `alter table meso_week_proposal add column groups jsonb`.
- [ ] `WeekProposalGroupJson(muscle, tier, bandLow, bandHigh, sportAdjusted, setsBefore, setsAfter, reasons)`;
  `build` stores one per trained counting group (reasons = the decider's + `deload_restore`/`no_slot`/`stalled` as
  in the audit). Line gets `dayName` (template day name), `fromKg`/`toKg` (null for sets/reps).
- [ ] `VolumeDecider.Input.plannedLastWeek`: `sets_missed` = logged < plannedLastWeek (= `before`, the plan as found,
  i.e. what last week prescribed), while stepping and the top check use the restored amount. Unit test + IT: a
  mid-block deload week fully done → the week after restores **and** steps (was: restores and holds).

### Task 3: Load lines

- [ ] `LoadLinePreview.lines(createdBy, run, plan)`: for each counting template-day row, the same style context as
  `getToday` and `SetRecommendationService.prescribe(..., deloadWeek=false, effective=row sets)`. Lever WEIGHT with a
  changed base → `weight` line `fromKg = reference top weight`, `toKg = base`; REP → `reps` line `from = ref reps`,
  `to = target reps`; a down move → its line with `grind`. Reasons: weight up `top_of_rep_range` (+ `reserve_left`
  when the reference RIR exceeded the target, `next_plate` when the base is the next grid step); rep up
  `reserve_left`; down `grind`. HOLD / no reference / bodyweight without change → none. No load lines in a deload
  week. The whole preview is failure-isolated (exception → no load lines, logged).
- [ ] `build` appends load lines after the set lines; `apply` (auto) marks them `accepted` without a write.
- [ ] IT: a run with history at the top of the range gets a weight line with the exact `fromKg/toKg` that `getToday`
  then prescribes; auto mode leaves amounts as before.

### Task 4: Lifecycle, manual mode, the restore (`.75` #1)

- [ ] At a week boundary, before building: every `pending` proposal of the run with `week < calWeek` (weekly and
  tier_change) → `expired`, `decidedAt = now`, its plan_after filled from the current plan, its restore pruned (below).
- [ ] Manual mode: build → stays `pending`; nothing written; the ledger untouched; `currentWeek` and `lastRun` still
  stamped (the week is recorded, not regenerated); the audit's change text reads as a proposal ("javaslat: +1 …")
  and no provenance adjustment is appended until a set line is applied.
- [ ] Restore: the lookup becomes "the latest weekly proposal before this week whose `restore` is non-empty, status
  applied / auto_applied / expired". A deload proposal that closes (applied or expired) keeps only the entries of its
  **accepted** lines. The restore is consumed (emptied) when the proposal carrying its `deload_restore` lines becomes
  `applied` — every line decided, whatever the decision; if that proposal expires instead, the restore is offered
  again next week.
- [ ] ITs (manual mode via `@TestPropertySource`): pending after the boundary, amounts unchanged; expired next week;
  deload partly accepted → only accepted rows restored; restore offered again after an expiry, gone after applied.

### Task 5: Decisions and the read

- [ ] `WeekProposalDecisionService.decide(createdBy, mesoId, proposalId, request)`, locking the run row like
  `generateIfDue`: validate; apply each accepted set line (row still at `from` → write `to`; else record `kept`);
  load lines only record; `acceptRest`/`keepRest` decide the remaining undecided lines; ledger sync + provenance
  adjustment for applied set lines; every line decided → `applied`, `decidedAt`, `planAfter`, restore consumption.
  Idempotent: the same decision again is a no-op.
- [ ] `WeekProposalQueryService.open(createdBy, mesoId)`: owner check (404), active run only, `generateIfDue`, then
  this week's weekly proposal (any status) + a pending tier_change. Mapper to the contract; `mode` from config.
- [ ] Controller handlers. ITs (`…/WeekProposalApiIT`): read generates once; per-line accept writes and syncs; keep
  writes nothing; acceptRest on a fresh proposal = applied; closed → 409; unknown line → 400; other user → 404; auto
  mode read shows `auto_applied` with all lines accepted.

### Task 6: The weekly pin

- [ ] `WorkoutService.getToday`: this week's weekly proposal's `kept` load lines (match by exercise id, else by
  identity on the same template day via `ExerciseHistoryResolver.identityKey`) → `holdOnly = true` for that
  exercise's prescription. Failure-isolated. `SetRecommendationService` itself is not changed (the pin rides the
  existing `holdOnly` knob — no T2 hot-spot edit).
- [ ] IT: kept weight line → the today view holds last week's weight; accepted → steps; next week → steps.

### Task 7: Tier or sport change raises a proposal (defect 9)

- [ ] `TrainService.updateMusclePriorities`: compute each group's band before and after; for groups whose band
  changed and whose plan is now outside the new band, the `PlanEvaluator` cap-respecting edits → set lines (reason
  `tier_change` + `above_band` or `room_in_band`), stored as a `tier_change` proposal of the current week. A pending
  tier_change of the run → `superseded` first. `auto` → applied at once (`auto_applied`); `manual` → pending. No changed group outside its band → no proposal.
- [ ] ITs: Építés → Hangsúly below the new band → +sets applied in auto; Hangsúly → Tartás above → cut; an
  untouched group above its band is not touched; manual: pending, a second change supersedes it.

### Task 8: Docs, gates, ship

- [ ] `docs/features/train.md` §4 Volume engine v2 (API, lifecycle, pin, tier change), §9 traps, §10; spec §12
  "S3 as built"; handbook `07-edzes/05-heti-volumen.md`; feature-index row; `node scripts/gen-codemap.mjs`;
  `node scripts/lint-docs.mjs` 0/0.
- [ ] Final whole-branch review; full backend suite `-Dmezo.test.use-testcontainers=true` incl. `ArchitectureTest`.
- [ ] Merge `--no-ff` (detached HEAD), push, deploy watch, production check: the owner's run still `auto_applied`
  amounts as before; the read returns this week's proposal for his run (or, without a session, the same code path
  replayed against his run's shape, as S2 did); no `pending` rows. Notion sync (`boop-notion`), bd close.

## Kész, ha…

- [ ] **Amit a tulajdonos lát:** semmi nem változik a telefonon és a weben (nincs új képernyő); a futó blokkja
  továbbra is magától lép hétről hétre; ha egy izom prioritását átállítja, a blokkja azonnal igazodik az új sávhoz.
- [ ] A heti javaslat olvasása visszaadja a futó blokk e heti javaslatát: izmonkénti kártya, gyakorlatonkénti
  változás (sorozat / súly / ismétlés) okokkal; a döntés gyakorlatonként és „mindet elfogadom / a többi marad”
  formában működik (ITs).
- [ ] Kézi módban a javaslat vár, semmi nem íródik át döntés nélkül, és a hét végén lejár (ITs).
- [ ] `.75`: kézi módban a könnyített hét utáni visszaállás döntéskor fogy el; a könnyített hét utáni hét nem
  ragad le, ha minden sorozat megvolt (ITs).
- [ ] A „marad” súlyjavaslat azon a héten tartja a múlt heti súlyt (IT).
- [ ] **Parity:** minden meglévő végpont és mező változatlan; auto módban a sorozatszámok ugyanúgy lépnek.
- [ ] **Gates:** focused ITs + `ArchitectureTest`, teljes backend suite Testcontainersszel; codemap; lint-docs 0/0.
- [ ] **Docs:** `train.md`, spec §12, handbook oldal, feature-index.
- [ ] **Shipped:** main-en, deploy zöld és a verzió él; production: a tulajdonos futása auto, javaslat olvasható,
  nincs függő javaslat; Notion `check` 0; bd lezárva.
