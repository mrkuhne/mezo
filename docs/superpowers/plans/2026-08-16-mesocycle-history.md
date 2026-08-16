# Mesocycle History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mesocycles historical — an explicit template entity with a run history under it, a frozen per-run result report (adherence, volume, strength, records, cross-domain context, self-eval, AI evaluation), and a two-run comparison view.

**Architecture:** Stamp-on-start template/run split: `mesocycle_template` is a new plan-document entity (days + volume baseline as typed jsonb); a run stays the existing `mesocycle` row, stamped from the template at start, so every existing engine (rollover, arc, prescriptions, goal links) is untouched. Close becomes a real closure: a train-owned deterministic report frozen into a new 1:1 `mesocycle_report` table, then a `MesocycleClosed` event feeds a companion-owned async context-gather + one-shot smart-tier AI review (ArchUnit forbids train→companion, so the event is the seam).

**Tech Stack:** Spring Boot 4 / Java 21 / Liquibase / PostgreSQL 16 (typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)`), OpenAPI contract-first codegen, React 19 + TanStack Query + vitest/MSW, Spring AI Gemini via the existing `CompanionLlm` port.

**Spec:** `docs/superpowers/specs/2026-08-16-mesocycle-history-design.md`

## Global Constraints

- **Read the house reference FIRST**: any backend task → the matching `docs/references/*.md` (java_package_structure, spring_patterns, error_handling, liquibase_conventions, testing_standards, integration_test_framework, configuration_conventions, api_contract_conventions); any frontend task → `docs/references/frontend_conventions.md`. Non-negotiable.
- Base package `io.mrkuhne.mezo`; UUID PKs (`gen_random_uuid()`); `created_by` from the security principal; soft delete via `@SQLDelete`/`@SQLRestriction`; constraint names `pk_/fk_/uq_/ck_/idx_`; **never `@Value`** (use `@Validated` `*Properties` records under `mezo:`); no hand-written boundary DTOs — contract first (`api/feature/train/train.yml` → `cd api/generate && npm run generate:api` → FE `cd frontend && pnpm generate:api`; backend types regenerate in `./mvnw`).
- Errors: `SystemRuntimeErrorException` + `SystemMessage` enum + `message.properties` entry; never hardcoded user text.
- Backend tests: integration-first, extend `AbstractIntegrationTest`/`ApiIntegrationTest`, AssertJ only, data via `*Populator` factories, `test{Method}_should{Result}_when{Condition}` names. New domain table → add to the `ResetDatabase` TRUNCATE list.
- **Local test commands are FOCUSED only.** Backend: `cd backend && ./mvnw clean test -Dtest='<YourITs>,ArchitectureTest'` with Bash `timeout: 900000`, foreground, one command per call — **NEVER the full backend suite locally** (16 GB machine OOMs; CI is the authoritative gate). Frontend: `pnpm test <substring-filter>` + `VITE_USE_MOCK=true pnpm test <substring-filter>` + `pnpm build` — filters are SUBSTRINGS, not regex. **Any edit under `frontend/src/data/**` or `frontend/src/test/msw/` ⇒ run the FULL FE suite in both modes.** Never run/regenerate `pnpm test:visual` in a task (per-platform goldens; handled at ship time). Never use `Monitor`/`run_in_background` to wait for a build.
- Local Postgres must be up for backend ITs: `cd backend && docker compose up -d` (port 15432).
- Commits: conventional subject + driving bd id, e.g. `feat(train): meso template CRUD (mezo-meyc.1)`; explicit `git add <paths>` + `git commit --no-verify` (the beads hook force-stages a stray root `issues.jsonl`; never `git add -A`).
- Hungarian UI copy; code/comments/commits in English.

## Ship protocol (used by every "Ship" task)

1. Branch already exists (`feat/<slice-topic>` cut from the merged state of the previous slice / `origin/main`). Verify no stray root `issues.jsonl` in the diff; verify `.beads/issues.jsonl` carries `mezo-meyc*` ids (`git show HEAD:.beads/issues.jsonl | grep meyc`).
2. `git push -u origin <branch>` → `gh pr create --fill` (self-PR = CI trigger).
3. If PR is CONFLICTING it gets NO CI run — `git merge origin/main` into the branch (never rebase; `.beads/issues.jsonl` conflicts resolve via `bd import <theirs> && bd export -o .beads/issues.jsonl` union; doc conflicts hand-union), push, re-check.
4. If `test-visual` is the only red: regenerate linux goldens via `gh workflow run update-visual-baselines.yml -r <branch>`; the bot commit does NOT auto-trigger CI — approve the `action_required` run via `gh api --method POST repos/mrkuhne/mezo/actions/runs/<run_id>/approve`; `git pull` the bot commit. Only accept goldens whose pixel moves match the intended UI change.
5. Green check: `gh pr checks <n>` and READ THE TABLE (`--watch` exit code lies).
6. Merge worktree-safe: `git checkout -b tmp origin/main` (own command, verify it succeeded) `&& git merge --no-ff --no-verify <branch> && git push origin tmp:main && git branch -D tmp`. Then delete the branch (local + remote).
7. Verify on origin/main afterwards: your commits present, `.beads/issues.jsonl` still carries your ids AND memory rows (`grep '"_type":"memory"'` count unchanged), no unrelated stowaway commits (`git log origin/main..main` empty in the primary checkout is not your concern here — you work from the worktree).
8. Main push fires `deploy.yml` (ungated, ADR 0007) — every main push deploys; watch the newest main-tip CI run (concurrency group may cancel intermediates; cancelled is fine iff newest tip goes green).

---

# Slice S1 — template/run split (`mezo-meyc.1`, branch `feat/meso-template-run-split`)

### Task 1: API contract — meso-template endpoints

**Files:**
- Modify: `api/feature/train/train.yml` (endpoints after the mesocycle block ~line 154; schemas near `MesocycleResponse` ~line 1297)
- Regenerate: `api/openapi.yml` (via `cd api/generate && npm run generate:api`), `frontend/src/data/_client/api.gen.ts` (via `cd frontend && pnpm generate:api`)

**Interfaces (Produces):** operations `listMesoTemplates`, `createMesoTemplate`, `updateMesoTemplate`, `deleteMesoTemplate`, `startMesoTemplate`, `rerunMesocycle`; schemas `MesoTemplateResponse`, `MesoTemplateUpsertRequest`, `MesoTemplateStartRequest`, `MesoRerunResponse`; `MesocycleResponse` gains `templateId` (uuid, nullable) + `closedAt` (date-time, nullable).

- [ ] **Step 1:** Read `docs/references/api_contract_conventions.md`. In `train.yml` add paths (mirror the style of the existing `/api/train/mesocycles` block — tags `train`, `operationId`, `$ref` responses):
  - `GET /api/train/meso-templates` → `200: MesoTemplateResponse[]`
  - `POST /api/train/meso-templates` (body `MesoTemplateUpsertRequest`) → `200: MesoTemplateResponse`
  - `PUT /api/train/meso-templates/{id}` (body `MesoTemplateUpsertRequest`) → `200: MesoTemplateResponse`
  - `DELETE /api/train/meso-templates/{id}` → `204`
  - `POST /api/train/meso-templates/{id}/start` (body `MesoTemplateStartRequest`) → `200: MesocycleResponse`
  - `POST /api/train/mesocycles/{id}/rerun` → `200: MesoRerunResponse`
  - **Remove** the `POST /api/train/mesocycles` operation (`createMesocycle`) and `MesocycleCreateRequest` schema.
- [ ] **Step 2:** Add schemas:
  - `MesoTemplateResponse`: required `[id, title, weeks, phaseCurve, days, runCount]`; props `id` uuid, `title`, `shortTitle` (nullable), `goal` (nullable), `weeks` int (1..16), `split` (nullable), `style` (nullable), `phaseCurve` array of the existing `MEV|MAV|MRV|Deload` enum (reuse the inline enum style of `MesocycleResponse.phaseCurve`), `notes` (nullable), `volumePerMuscle` object `additionalProperties: $ref VolumeBaseline` (nullable), `days` array `$ref MesoDay`, `runCount` int.
  - `MesoTemplateUpsertRequest`: required `[title, weeks, phaseCurve, days]`; same fields minus `id`/`runCount`, `days` as `MesoDayInput[]`, `volumePerMuscle` as map of `VolumeBaseline`.
  - `MesoTemplateStartRequest`: required `[startDate, status]`; `startDate` date, `status` enum `[active, planned]`.
  - `MesoRerunResponse`: required `[templateId]`; `templateId` uuid.
  - `MesocycleResponse`: add `templateId` (uuid, nullable), `closedAt` (string date-time, nullable).
- [ ] **Step 3:** `cd api/generate && npm run generate:api` — expect clean merge; then `cd frontend && pnpm generate:api`.
- [ ] **Step 4:** `cd frontend && pnpm build` — expect FAIL ONLY where `createMesocycle` types vanished (planner + trainApi/trainHooks + MSW). Do NOT fix here (Task 5/6 does); if it fails elsewhere, fix the contract. Record the failing file list in your report.
- [ ] **Step 5:** Commit: `git add api/ frontend/src/data/_client/api.gen.ts && git commit --no-verify -m "feat(api): meso-template contract — CRUD, start, rerun (mezo-meyc.1)"`

### Task 2: DDL + entity + repository + test plumbing

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608161200_mezo-meyc.1_create_meso_template.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append two changeSets)
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608161210_mezo-meyc.1_mesocycle_template_link.sql`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MesoTemplateEntity.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/json/MesoDayJson.java` + `GymExerciseJson.java` + `VolumeBaselineJson.java` (records for the typed jsonb; skip creation if equivalent records already exist under `feature/train` — reuse instead)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/entity/MesocycleEntity.java` (add `templateId`, `closedAt`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/repository/MesoTemplateRepository.java`
- Modify: the `ResetDatabase` TRUNCATE list (find via `grep -r "TRUNCATE" backend/src/test`) — add `meso_template`
- Create: `MesoTemplatePopulator` next to the existing populators (find them via `grep -rl "Populator" backend/src/test/java | head`)

**Interfaces (Produces):** `MesoTemplateEntity` fields: `title, shortTitle, goal, weeks (Integer), split, style, phaseCurve (List<String>), notes, days (List<MesoDayJson>), volumePerMuscle (Map<String, VolumeBaselineJson>)` extending `OwnedEntity`. `MesoTemplateRepository extends JpaRepository<MesoTemplateEntity, UUID>` with `findByCreatedByAndDeletedFalseOrderByCreatedAtAsc(UUID)` and `findByIdAndCreatedByAndDeletedFalse(UUID, UUID)`. `MesocycleEntity` gains `templateId (UUID)`, `closedAt (Instant)`. `MesoTemplatePopulator.template(UUID createdBy)` returns a persisted 2-day template with 2 exercises/day + volume baseline for `chest`/`back`.

- [ ] **Step 1:** Read `docs/references/liquibase_conventions.md`. Write `..._create_meso_template.sql` (mirror column style of `202606111400_mezo-n5q_create_train.sql`):

```sql
CREATE TABLE meso_template (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    title TEXT NOT NULL,
    short_title TEXT,
    goal TEXT,
    weeks INTEGER NOT NULL,
    split TEXT,
    style TEXT,
    phase_curve TEXT[] NOT NULL DEFAULT '{}',
    notes TEXT,
    days JSONB NOT NULL DEFAULT '[]',
    volume_per_muscle JSONB,
    CONSTRAINT fk_meso_template_user FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE CASCADE
);
CREATE INDEX idx_meso_template_created_by ON meso_template (created_by);
```

  (Check `create_train.sql` first: if `mesocycle` has extra audit columns (e.g. `updated_at`) mirror them; if `OwnedEntity` maps a column not listed here, add it.)
- [ ] **Step 2:** Write `..._mesocycle_template_link.sql`:

```sql
ALTER TABLE mesocycle ADD COLUMN template_id UUID;
ALTER TABLE mesocycle ADD COLUMN closed_at TIMESTAMPTZ;
ALTER TABLE mesocycle ADD CONSTRAINT fk_mesocycle_template FOREIGN KEY (template_id) REFERENCES meso_template (id);
CREATE INDEX idx_mesocycle_template_id ON mesocycle (template_id);
```

- [ ] **Step 3:** Register both in `1.0.0_master.yml` (ids `1.0.0:202608161200_mezo-meyc.1_create_meso_template` and `...1210...`, author `daniel.kuhne`, `sqlFile` + `relativeToChangelogFile: true` — copy the last changeSet's shape).
- [ ] **Step 4:** Entity + jsonb records. `MesoTemplateEntity` mirrors `MesocycleEntity`'s Lombok/annotation style (`@SQLDelete`, `@SQLRestriction`, `phase_curve` as `List<String>`); `days`/`volumePerMuscle` use `@JdbcTypeCode(SqlTypes.JSON)` (copy the idiom from `MuscleGroupVolumeLogEntity.source` / `MesocycleEntity.volumeRecompute`). `MesoDayJson`/`GymExerciseJson` mirror the field set of the contract's `MesoDayInput`/`GymExerciseInput` (open `api/feature/train/train.yml:1694` and `:1717` and copy every field 1:1 — day label, type, exercises; name, muscle, type, warmupSets, workingSets, repMin, repMax, targetRIR, anchorWeightKg, catalogId, plus any others present). `VolumeBaselineJson` mirrors the `VolumeBaseline` schema. Add `templateId`/`closedAt` columns to `MesocycleEntity`.
- [ ] **Step 5:** Repository + `ResetDatabase` + `MesoTemplatePopulator` (persist via the repository; fixed deterministic values: title "Sablon A", weeks 4, phaseCurve `[MEV, MAV, MRV, Deload]`, 2 days with exercises named "Bench Press"/"Row" style with workingSets 3, repMin 8, repMax 12, targetRIR 2).
- [ ] **Step 6:** Focused compile+context check: `cd backend && ./mvnw clean test -Dtest='ArchitectureTest'` (timeout 900000, foreground). Expect PASS (Liquibase runs on context start of any IT — if `ArchitectureTest` is not `@SpringBootTest`, run `-Dtest='ProvenanceRoundTripIT'` instead to force a context+migration run).
- [ ] **Step 7:** Commit: `feat(train): meso_template table + entity + template link columns (mezo-meyc.1)`

### Task 3: Backend — template CRUD service/controller

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoTemplateService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/controller/TrainController.java` (implement the newly generated `TrainApi` methods)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/mapper/` — extend the existing MapStruct mapper (find `TrainMapper.java`) with entity↔DTO methods for templates
- Modify: `SystemMessage` enum + `message.properties`: add `TRAIN_MESO_TEMPLATE_NOT_FOUND`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoTemplateIT.java` (place next to `CustomWorkoutIT` — find it and mirror its base class + helpers)

**Interfaces:**
- Consumes: Task 2 entity/repo; generated `TrainApi` methods + `api.dto` models from Task 1.
- Produces: `MesoTemplateService` public methods `list(UUID createdBy)`, `create(UUID, MesoTemplateUpsertRequest)`, `update(UUID, UUID id, MesoTemplateUpsertRequest)`, `delete(UUID, UUID id)`, plus package-visible `ownedTemplateOrThrow(UUID createdBy, UUID id)`. `runCount` = `MesocycleRepository.countByTemplateIdAndCreatedByAndDeletedFalse(UUID, UUID)` (add this derived method).

- [ ] **Step 1:** Write failing IT `MesoTemplateIT` (HTTP-level, `ApiIntegrationTest` idiom — `ownerAuthHeaders()`, verb helpers, SystemMessage asserts). Tests:
  - `testCreateTemplate_shouldRoundTripPlanDocument_whenValidRequest` — POST a 2-day template, GET list, assert title/weeks/phaseCurve/days (exercise recipe fields) and `runCount == 0`.
  - `testUpdateTemplate_shouldReplaceDaysAndBaseline_whenValidRequest`
  - `testDeleteTemplate_shouldSoftDelete_whenOwned` — list no longer contains it.
  - `testUpdateTemplate_shouldReturn404_whenForeignOwner` — assert `TRAIN_MESO_TEMPLATE_NOT_FOUND`.
- [ ] **Step 2:** `cd backend && ./mvnw clean test -Dtest='MesoTemplateIT'` (timeout 900000) — expect FAIL (404/501 on unimplemented ops).
- [ ] **Step 3:** Implement service (constructor injection + `@RequiredArgsConstructor`, `@Transactional` method-level on writes only), mapper methods, controller wiring, `SystemMessage` entry.
- [ ] **Step 4:** `./mvnw clean test -Dtest='MesoTemplateIT,ArchitectureTest'` — expect PASS.
- [ ] **Step 5:** Commit: `feat(train): meso template CRUD (mezo-meyc.1)`

### Task 4: Backend — start (stamp) + rerun (materialize)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/MesoTemplateService.java` (add `start`, `rerun`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/TrainService.java` — refactor: extract the row-stitching of `createMesocycle` (`TrainService.java:109-157`) into a reusable package-visible `stampRun(UUID createdBy, StampSource src)` used by `start`; DELETE the public `createMesocycle` API path (controller method disappears with the regenerated `TrainApi`; keep any internal logic only via `stampRun`).
- Modify: `TrainController.java` (wire `startMesoTemplate`, `rerunMesocycle`)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesoTemplateIT.java` (add stamp/rerun tests)

**Interfaces:**
- Produces: `start(UUID createdBy, UUID templateId, MesoTemplateStartRequest)` → `MesocycleResponse`: creates the `mesocycle` row (title/shortTitle/goal/weeks/split/style/phaseCurve/notes copied; `startDate` from request; `endDate`/`currentWeek`/`orderIndex` computed exactly as the old create — reuse its code; `templateId` set; start-as-active archives other actives via the existing `archiveActiveMesos`), materializes `days` jsonb → `workout_session` template rows + `exercise` rows (reuse `toExerciseEntity`/`toDay` helpers in `TrainService`; unknown `catalogId` → 400 as today), and `volumePerMuscle` → `muscle_group_volume_log` rows (baseline `ProvenanceEnvelope`, copy the shape `createMesocycle` used).
- `rerun(UUID createdBy, UUID mesocycleId)` → `MesoRerunResponse`: if the run's `templateId` is null, build a `MesoTemplateEntity` from the run's rows (metadata + its template `workout_session`/`exercise` rows mapped back into `MesoDayJson`, volume-log baselines into `VolumeBaselineJson`), link it back onto the run (`run.setTemplateId(...)`), return its id; if already linked, return the existing id.

- [ ] **Step 1:** Add failing tests to `MesoTemplateIT`:
  - `testStartTemplate_shouldStampFullRun_whenActive` — populate template via `MesoTemplatePopulator`, POST start `{startDate: today, status: active}`; assert response `status=active`, `templateId` set, `currentWeek>=1`; GET `/api/train/mesocycles` and assert the run carries the template's days/exercises and `volumePerMuscle` keys.
  - `testStartTemplate_shouldArchiveOtherActives_whenActive` — start twice; first run's status flips to `archived`.
  - `testStartTemplate_shouldCreatePlannedRun_whenPlannedStatus` — `currentWeek == 0`, no archiving.
  - `testRerun_shouldMaterializeTemplate_whenLegacyRunHasNone` — create a legacy run DIRECTLY via repositories/populator (no template), POST rerun, assert `templateId` returned + now linked on the run + template days mirror the run's day rows.
  - `testRerun_shouldReturnExistingTemplate_whenAlreadyLinked`
- [ ] **Step 2:** Run focused: FAIL. **Step 3:** Implement. **Step 4:** `./mvnw clean test -Dtest='MesoTemplateIT,CustomWorkoutIT,ArchitectureTest'` (CustomWorkoutIT guards the `TrainService` refactor blast radius) — PASS.
- [ ] **Step 5:** Grep for orphaned usages of the removed create op: `grep -rn "createMesocycle" backend/src` — only `stampRun` internals may remain. Commit: `feat(train): stamp-on-start + legacy rerun materialization (mezo-meyc.1)`

### Task 5: FE data layer — template hooks, mock fixtures, MSW

**Files:**
- Modify: `frontend/src/data/types.ts` (add `MesoTemplate` domain type; `Mesocycle` gains `templateId?`, `closedAt?`)
- Modify: `frontend/src/data/train/trainApi.ts` (add template calls; remove `createMesocycle`)
- Create: `frontend/src/data/train/mesoTemplateHooks.ts` (mirror `mesoArcHooks.ts` structure for reads + `trainHooks.ts` mutation idiom)
- Modify: `frontend/src/data/hooks.ts` (barrel re-export `useMesoTemplates`)
- Modify: `frontend/src/data/train/train.ts` (add `mesoTemplatesMock`: 2 templates — derive one from the active `meso-hyp-04` fixture's days with `runCount: 1`, one fresh with `runCount: 0`)
- Modify: `frontend/src/data/train/trainHooks.ts` (drop `createMesocycle` mutation + exposure)
- Modify: `frontend/src/test/msw/handlers.ts` (handlers: GET/POST/PUT/DELETE `/api/train/meso-templates*`, POST `.../start`, POST `/api/train/mesocycles/:id/rerun`; remove the old create handler)

**Interfaces (Produces):** `useMesoTemplates()` → `{ templates: MesoTemplate[], pending: boolean, createTemplate(input): Promise<MesoTemplate>, updateTemplate(id, input): Promise<MesoTemplate>, deleteTemplate(id): Promise<void>, startTemplate(id, {startDate, status}): Promise<Mesocycle>, rerun(mesoId): Promise<{templateId: string}> }`. Reads dual-mode (`useDualQuery`, mock `initialData` from `mesoTemplatesMock`); writes no-op in mock but update the query cache optimistically (`setQueryData`) so the PWA demo works. Mutations invalidate `['train','mesocycles']` and `['train','mesoTemplates']`.

- [ ] **Step 1:** Write failing colocated test `frontend/src/data/train/mesoTemplateHooks.test.ts` (mirror an existing hooks test file for the QueryClient/MSW harness): real mode lists templates from MSW; `startTemplate` posts and returns a run; mock mode serves fixtures synchronously.
- [ ] **Step 2:** `pnpm test mesoTemplateHooks` — FAIL. **Step 3:** Implement all files. **Step 4:** Data-layer edit ⇒ FULL suite both modes: `pnpm test` then `VITE_USE_MOCK=true pnpm test`, then `pnpm build` (each foreground, timeout 900000). Fix planner compile fallout ONLY by stubbing its save call to `useMesoTemplates` if trivially small; otherwise leave the planner red for Task 6 and note it — but the suite must be green, so prefer doing the minimal planner rewire here if tests demand it.
- [ ] **Step 5:** Commit: `feat(data): meso template hooks + fixtures + MSW (mezo-meyc.1)`

### Task 6: FE pages — planner saves templates, library restructure, template editor, start/rerun UX

**Files:**
- Modify: `frontend/src/features/train/pages/MesocyclePlannerPage.tsx` (`saveMesocycle` at ~:186-218 → `saveTemplate(alsoStart: boolean)`; terminal buttons „Mentés sablonként" / „Mentés + indítás")
- Modify: `frontend/src/features/train/pages/MesocycleLibraryPage.tsx` (sections: **Sablonok** → **Aktív** → **Tervezett** → **Történet**)
- Create: `frontend/src/features/train/components/MesoTemplateCard.tsx` (title, goal·split·weeks meta, `n× futtatva` badge, actions: Szerkesztés → template editor, Indítás → start sheet)
- Create: `frontend/src/features/train/sheets/MesoStartSheet.tsx` (date input default today + `active|planned` segmented pick → `startTemplate`; on success navigate `/train/gym` for active, stay for planned)
- Create: `frontend/src/features/train/pages/MesoTemplateEditorPage.tsx` (route `/train/mesocycles/templates/:id`; loads template, renders shared `MesoEditor` on its days, persists via `updateTemplate` on change — mirror how `MesoExercises.tsx` seeds day state and fires background PUTs)
- Modify: `frontend/src/app/router.tsx` (~:76: add the template editor route as a full-screen sibling; keep existing routes)
- Modify: `frontend/src/features/train/components/ArchivedMesoCard.tsx` (add „Újrafuttatás" action: `rerun(meso.id)` → open `MesoStartSheet` with returned templateId)
- Tests: colocated `MesocycleLibraryPage.test.tsx` (modify), `MesoTemplateEditorPage.test.tsx` + `MesoStartSheet.test.tsx` (create), planner test file (modify save-path assertions)

**Interfaces:** Consumes `useMesoTemplates()` exactly as produced by Task 5. UI follows the DS: section heads use the eyebrow + label-mono count idiom, cards on DS card chrome, dashed CTAs on `.dashedcta` (see `MesocycleLibraryPage.tsx`'s existing sections).

- [ ] **Step 1:** Failing tests first (both modes matter — mock renders from fixtures):
  - Library shows a `Sablonok` section with 2 fixture templates and their `futtatva` badges; `Történet` header replaces `Archív`.
  - Planner terminal step: „Mentés sablonként" calls `createTemplate` (NOT any mesocycle POST); „Mentés + indítás" calls `createTemplate` then `startTemplate` with the wizard's start date + `active`.
  - `MesoStartSheet` posts `{startDate, status}` and closes.
  - Template editor renders `MesoEditor` with the template's day tabs and fires `updateTemplate` on an exercise change.
  - ArchivedMesoCard „Újrafuttatás" → `rerun` then opens start sheet.
- [ ] **Step 2:** `pnpm test Mesocycle MesoTemplate MesoStart` (substring filters) — FAIL. **Step 3:** Implement. **Step 4:** `pnpm test` + `VITE_USE_MOCK=true pnpm test` (page tests interact with shared fixtures — run full), `pnpm build`. PASS required.
- [ ] **Step 5:** Commit: `feat(train): template library + planner-to-template + editor + start/rerun UX (mezo-meyc.1)`

### Task 7: S1 docs — ADR, train.md, lint

**Files:**
- Create: `docs/decisions/0027-mesocycle-template-run-history.md` (ADR: template/run split, stamp-on-start over normalization/clone, event-seam placement for S3, spec pointer)
- Modify: `docs/features/train.md` — §2 (`Mesociklusok` library subsection: new section order + template editor + start sheet + planner relabel), §4 (Mesocycles subsection: `meso_template` table/entity, new endpoints, removed create, `templateId`/`closedAt`), §10 key files
- Modify: `docs/milestones/roadmap.md` (mesocycle-history line: S1 shipped, S2–S4 next)
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1:** Write ADR (mirror an existing ADR's header format; status Accepted; context/decision/consequences ≤80 lines). **Step 2:** Update `train.md` sections in place (overwrite, no changelog; `file:line` pointers over pasted code). **Step 3:** `node scripts/lint-docs.mjs` — must exit clean (clears the staleness flag). **Step 4:** Commit: `docs(train): mesocycle template/run split — ADR 0027 + feature doc (mezo-meyc.1)`

### Task 8: Ship S1

- [ ] `bd update mezo-meyc.1 --claim` was done at slice start; now run the **Ship protocol** (top of plan) for `feat/meso-template-run-split`; after merge: `bd close mezo-meyc.1`, ensure `.beads/issues.jsonl` union-exported and committed (verify meyc ids + memory-row count in the committed file).

---

# Slice S2 — deterministic close report (`mezo-meyc.2`, branch `feat/meso-close-report`)

### Task 9: API contract — close body, report endpoints

**Files:** Modify `api/feature/train/train.yml`; regenerate both codegens (same commands as Task 1).

**Interfaces (Produces):**
- `POST /api/train/mesocycles/{id}/close` gains optional requestBody `MesocycleCloseRequest` `{selfEval?: string, maxLength 2000}` (response unchanged).
- `GET /api/train/mesocycles/{id}/report` → `200: MesocycleReportResponse`, `404` when none.
- `POST /api/train/mesocycles/{id}/report/regenerate` → `202` (empty), `409` when the run is not archived.
- `MesocycleResponse` gains `hasReport: boolean` (required, default false).
- Schemas: `MesocycleReportResponse` required `[mesocycleId, title, startDate, weeks, aiEvalStatus, aiEvalEnabled, adherence, strength, records]` with props: `mesocycleId` uuid, `templateId` uuid nullable, `title`, `startDate` date, `endDate` date nullable, `closedAt` date-time nullable, `weeks` int, `selfEval` nullable, `aiEval` nullable, `aiEvalStatus` enum `[pending, ready, failed]`, `aiEvalGeneratedAt` date-time nullable, `aiEvalEnabled` boolean, `adherence: MesoReportAdherence`, `volume: MesocycleVolumeArcResponse` (nullable — reuse), `strength: MesoStrengthDelta[]`, `records: MesoReportRecords`, `context: MesoContext` nullable (**declare the full context schema now** so S3 is backend-only: `MesoContext {weeks: MesoContextWeek[], totals: MesoContextTotals}`; `MesoContextWeek {week int req, sleepAvgH?, sleepQualityAvg?, kcalAvg?, kcalTargetAvg?, mealCoverageDays?, waterAvgMl?, energyAvg?, stressAvg?, weightDeltaKg?, sportMinutes?, sportSessions?, runSessions?, gymRpeAvg?}` all numbers nullable; `MesoContextTotals {daysTotal int req, sleepAvgH?, kcalAvg?, energyAvg?, stressAvg?, weightChangeKg?, sportMinutes?, sportSessions?, runSessions?, mealCoverageDays?}`).
- `MesoReportAdherence {plannedSessions, completedSessions, plannedWeeks, completedWeeks, completionPct}` all int required.
- `MesoStrengthDelta {exerciseName req, catalogId uuid?, muscle req, firstWeek int req, lastWeek int req, firstTopKg?, firstTopReps int req, lastTopKg?, lastTopReps int req, firstE1rm?, lastE1rm?, deltaKg?, deltaPct?}`.
- `MesoReportRecords {medalCount int req, top: MesoRecordHighlight[] req}`; `MesoRecordHighlight {exerciseName req, kind req (string), date date req, value?}`.

- [ ] Steps: edit yml → generate both → `pnpm build` (expect green — nothing consumed yet) → commit `feat(api): mesocycle close body + report contract (mezo-meyc.2)`.

### Task 10: DDL + report entity/repo

**Files:**
- Create: `backend/.../script/202608161600_mezo-meyc.2_create_mesocycle_report.sql` + master registration
- Create: `feature/train/entity/MesocycleReportEntity.java` + `entity/json/MesoReportJson.java` (+ nested records: `Adherence`, `StrengthDelta`, `Records`, `RecordHighlight`, `VolumeArcJson` mirroring `MesocycleVolumeArcResponse` fields) + `entity/json/MesoContextJson.java` (weeks/totals records mirroring the contract)
- Create: `feature/train/repository/MesocycleReportRepository.java` (`findByMesocycleIdAndCreatedByAndDeletedFalse`, `findByCreatedByAndMesocycleIdIn`)
- Modify: `ResetDatabase` TRUNCATE list (+`mesocycle_report`)

```sql
CREATE TABLE mesocycle_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    mesocycle_id UUID NOT NULL,
    report JSONB,
    context JSONB,
    self_eval TEXT,
    ai_eval TEXT,
    ai_eval_status TEXT NOT NULL DEFAULT 'pending',
    ai_eval_generated_at TIMESTAMPTZ,
    CONSTRAINT fk_mesocycle_report_user FOREIGN KEY (created_by) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_mesocycle_report_mesocycle FOREIGN KEY (mesocycle_id) REFERENCES mesocycle (id) ON DELETE CASCADE,
    CONSTRAINT uq_mesocycle_report_mesocycle UNIQUE (mesocycle_id),
    CONSTRAINT ck_mesocycle_report_ai_status CHECK (ai_eval_status IN ('pending','ready','failed'))
);
```

- [ ] Steps: SQL + registration → entity (jsonb idiom as Task 2) + repo + ResetDatabase → `./mvnw clean test -Dtest='ArchitectureTest'` (or one fast IT) → commit `feat(train): mesocycle_report table + entity (mezo-meyc.2)`.

### Task 11: Backend — report computation + close extension + endpoints

**Files:**
- Create: `feature/train/service/MesocycleReportService.java`
- Modify: `feature/train/service/TrainService.java` (`closeMesocycle` at :171-178: set `closedAt`, persist `selfEval`, call `reportService.computeAndStore(run)`; stays idempotent — an already-archived run returns without recompute)
- Modify: `TrainController.java` (wire `getMesocycleReport`, `regenerateMesocycleReport`, close body)
- Modify: `TrainService.listMesocycles` (populate `hasReport` via one `findByCreatedByAndMesocycleIdIn` batch; populate `templateId`/`closedAt` on the response if Task 4 didn't already)
- Modify: `SystemMessage` + `message.properties`: `TRAIN_MESO_REPORT_NOT_FOUND`, `TRAIN_MESO_NOT_CLOSED`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/MesocycleCloseReportIT.java`

**Interfaces:**
- Produces: `MesocycleReportService.computeAndStore(MesocycleEntity run)` — upserts the report row: adherence (plannedWeeks = `run.weeks`; weeksElapsed = `MesoWeeks.clampWeek(startDate, weeks)` at close time; plannedSessions = countNonEmptyTemplateDays × weeksElapsed; completedSessions = completed meso-origin instances of THIS run (`WorkoutSessionRepository` — add `countByCreatedByAndMesocycleIdAndStatusAndTemplateSessionIdIsNotNull` or filter an existing finder); completedWeeks = distinct `MesoWeeks.weekOf(startDate, instance.date)`; completionPct rounded), volume = `VolumeArcService.arc(...)` mapped into `VolumeArcJson`, strength deltas (below), records (below). Also `getReport(UUID createdBy, UUID mesoId)` → response DTO (404 when absent; `aiEvalEnabled` false constant in S2 — S3 flips it to the switch) and `regenerate(UUID createdBy, UUID mesoId)` → recompute deterministic part + reset status `pending` (409 `TRAIN_MESO_NOT_CLOSED` unless status `archived`; serves legacy runs with no report — `closedAt` window falls back to `endDate`).
- **Strength:** for the run's completed instances, group logged non-skipped `working` sets by exercise identity (resolve identity per exercise row the way `ExerciseHistoryResolver` does — catalogId else exact name; read that class first and reuse it if its API allows). Per identity: bucket sets by `MesoWeeks.weekOf(startDate, instanceDate)`; first bucket vs last bucket top set (max e1RM, `e1rm = weight * (1 + reps/30.0)`; weightless sets → e1rm null, compare by reps); emit delta only when ≥2 distinct weeks; sort by `deltaPct` desc nulls-last.
- **Records:** derive medals per completed instance using the same evaluator the workout-finish path uses (find it: `grep -rn "Medal" backend/src/main/java/io/mrkuhne/mezo/feature/train --include=*.java -l`); aggregate `medalCount` + top 5 highlights (kind, exercise, date, value) ordered by date.

- [ ] **Step 1:** Failing ITs (`AbstractIntegrationTest` service-level is fine here; use populators to build a 2-week run with 3 completed instances, known sets):
  - `testCloseMesocycle_shouldFreezeReport_whenActiveRunCloses` — adherence numbers exact; strength delta exact for a known identity (e.g. 60kg×8 W1 → 70kg×8 W2 ⇒ deltaKg 10); `closedAt` set; selfEval persisted.
  - `testCloseMesocycle_shouldBeIdempotent_whenAlreadyArchived` — second close does not recompute (mutate a set after first close, re-close, report unchanged).
  - `testGetReport_shouldReturn404_whenNoneExists`
  - `testRegenerate_shouldBackfillLegacyArchivedRun_whenNoReport` (endDate window fallback) and `testRegenerate_shouldReturn409_whenRunActive`.
- [ ] **Step 2:** `./mvnw clean test -Dtest='MesocycleCloseReportIT'` — FAIL. **Step 3:** Implement. **Step 4:** `./mvnw clean test -Dtest='MesocycleCloseReportIT,MesoTemplateIT,ArchitectureTest'` — PASS. **Step 5:** Commit `feat(train): close-time frozen run report + report endpoints (mezo-meyc.2)`.

### Task 12: FE — close sheet, report page, hooks

**Files:**
- Create: `frontend/src/data/train/mesoReportHooks.ts` (`useMesoReport(id)` → `{report, pending, regenerate}`; dual-mode: mock serves `mesoReportMock` for the archived fixture `meso-rec-03`; real: query `['train','mesoReport',id]`, `refetchInterval: (q) => q.state.data?.aiEvalStatus === 'pending' && q.state.data?.aiEvalEnabled ? 3000 : false`)
- Modify: `frontend/src/data/train/train.ts` (add `mesoReportMock`: full report for `meso-rec-03` — adherence 8 weeks, a 6-muscle volume arc reusing `mesoVolumeArcMock` shapes, 5 strength deltas, 3 records, `aiEvalStatus:'ready'`, `aiEvalEnabled:true`, selfEval = the existing fixture summary text, context: null until S3 task adds it)
- Modify: `frontend/src/data/train/trainApi.ts` (+`getMesoReport`, `regenerateMesoReport`, close body param), `frontend/src/data/hooks.ts` (barrel), `frontend/src/test/msw/handlers.ts` (+report/regenerate/close-body handlers)
- Create: `frontend/src/features/train/sheets/MesoCloseSheet.tsx` (summary line + optional textarea „Saját értékelés" + confirm → `closeMesocycle(id, selfEval)` → navigate to report)
- Modify: `frontend/src/data/train/trainHooks.ts` (`closeMesocycle(id, selfEval?)` — pass body)
- Create: `frontend/src/features/train/pages/MesoReportPage.tsx` (route `/train/mesocycles/:id/report` in `router.tsx`): back breadcrumb (`useBackNav` idiom from `MesoOverviewPage.tsx`), header (title/dates/template link), adherence stat strip, frozen arc via existing `VolumeArcChart` + muscle pill switch (mirror `MesoOverviewPage`'s consumption), strength top list (name, `60→70 kg` + `+16%` pill), records list, self-eval block, „Riport generálása" button when 404/no report (calls `regenerate` then polls), „Újrafuttatás" CTA (Task 6's rerun flow)
- Modify: `MesocycleBuilderPage.tsx` (:117-141 actions: „Meso lezárása" now opens `MesoCloseSheet`; archived runs navigate to `/train/mesocycles/{id}/report`), `ArchivedMesoCard.tsx` (tap → report page)
- Tests: colocated for the page, sheet, and hooks

- [ ] **Step 1:** Failing tests: report page renders adherence/strength/records from mock fixture; close sheet posts body and navigates; archived card routes to report; regenerate button fires POST and flips to polling; builder close button opens sheet.
- [ ] **Step 2:** `pnpm test MesoReport MesoClose` — FAIL. **Step 3:** Implement. **Step 4:** Data-layer touched ⇒ FULL `pnpm test` + `VITE_USE_MOCK=true pnpm test` + `pnpm build` — PASS. **Step 5:** Commit `feat(train): close sheet + run report page (mezo-meyc.2)`.

### Task 13: S2 docs + Ship

- [ ] Update `docs/features/train.md` (§2 new `Riport` surface + close-sheet flow; §4 report table/endpoints/DTOs + close-body; §10 key files), roadmap line; `node scripts/lint-docs.mjs` clean; commit `docs(train): run report + close flow (mezo-meyc.2)`.
- [ ] Run **Ship protocol** for `feat/meso-close-report`; then `bd close mezo-meyc.2` + union-export verify.

---

# Slice S3 — context + AI evaluation (`mezo-meyc.3`, branch `feat/meso-ai-review`)

### Task 14: Train — MesocycleClosed event + pending wiring

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/MesocycleClosed.java` (`public record MesocycleClosed(UUID userId, UUID mesocycleId) {}` — top of the train package, like other cross-feature events; check how `ChatTurnCompleted` is declared/published first and mirror its location idiom)
- Modify: `TrainService.closeMesocycle` + `MesocycleReportService.regenerate`: publish via `ApplicationEventPublisher` after persisting (status already `pending` on fresh rows; regenerate resets it)
- Modify: `MesocycleReportService.getReport`: `aiEvalEnabled` now reads the S3 switch bean (`ObjectProvider<MesoReviewGate>` non-null ⇒ true)
- Modify: `MesocycleCloseReportIT` (assert event published — use `@RecordApplicationEvents` or a test listener)

- [ ] Failing test → implement → `./mvnw clean test -Dtest='MesocycleCloseReportIT,ArchitectureTest'` → commit `feat(train): MesocycleClosed event + aiEvalEnabled wiring (mezo-meyc.3)`.

### Task 15: Companion — context assembler + MesoReviewGenerator + listener

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoContextAssembler.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoReviewGenerator.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/MesoReviewListener.java` (`@Async @TransactionalEventListener(phase = AFTER_COMMIT)` on `MesocycleClosed` — copy `FactExtractionListener.java:28-29`'s shape)
- Create: `feature/companion/MesoReviewGate.java` (`@ConditionalOnProperty` marker on `mezo.feature.meso-review.enabled`, default true — mirror `HypertrophyDriveGate`; constant in `FeaturesConfiguration`)
- Modify: `backend/src/main/resources/application.yml` (`mezo.feature.meso-review.enabled: true`)
- Modify: `feature/companion/llm/FakeCompanionLlm.java` (dispatch on `MesoReviewGenerator.MESO_REVIEW_MARKER` → canned Hungarian review text)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/MesoReviewGeneratorIT.java`

**Interfaces:**
- `MesoContextAssembler.assemble(UUID userId, LocalDate startDate, LocalDate endDate, int weeks)` → the train-owned `MesoContextJson` (companion→train dependency is the sanctioned direction). Buckets: per meso-week W1..Wn (`week = min(weeks, ((date - startDate).days / 7) + 1)` — do NOT import train's package-private `MesoWeeks`; inline this two-line formula). Sources — all via `MetricSeriesService.series(userId, key, from, to)`: `SLEEP_DURATION_H`, `SLEEP_QUALITY`, `DAILY_KCAL`, `DAILY_WATER_ML`, `CHECKIN_ENERGY`, `CHECKIN_STRESS`, `WEIGHT_DELTA_KG` (weekly sum + cumulative total), `SPORT_LOAD_MIN` (weekly sum), `TRAINING_RPE` (weekly avg). Session counts via `SportSessionRepository`/`RunSessionLogRepository` date-ranged finders (open-ended `GreaterThanEqual` + in-memory `isAfter(to)` filter — the `MetricSeriesService` idiom). `mealCoverageDays` = count of days with a `DAILY_KCAL` datapoint; `kcalTargetAvg` from the same target source `FuelDayService`/`NutritionTargetsProperties` exposes (read `ContextSnapshotAssembler:428` first, reuse its accessor).
- `MesoReviewGenerator.generate(UUID userId, UUID mesocycleId)`: load report row via train's `MesocycleReportRepository` (skip unless `ai_eval_status = 'pending'` — idempotent); assemble + persist `context`; if `MesoReviewGate` absent → return (context stays, status stays pending, FE hides via `aiEvalEnabled=false`); else build prompt = `MESO_REVIEW_MARKER` + Hungarian instruction block (structure: mit sikerült / mi akadt el / kereszt-domain mintázatok / következő futam javaslatai; ADR 0010 tone, no clinical claims) + serialized report + context JSON; ONE `companionLlm.completeSmart(system, user)` inside `llmCallContextHolder.runWith(new LlmCallContext("meso_review", "generate", ...))` (copy `MemoirGenerator.java:82`'s wrapping); persist `ai_eval` + `ready` + `generatedAt`; on exception persist `failed` (catch inside, never rethrow past the listener).
- `public static final String MESO_REVIEW_MARKER = "[MESO_REVIEW]"`.

- [ ] **Step 1:** Failing ITs (`MesoReviewGeneratorIT`, service-level, `companion-fake` profile like the other generator ITs — find how `MemoirGenerator`'s IT activates the fake and mirror):
  - `testGenerate_shouldPersistContextAndReview_whenPending` — populate a closed run + report row (S2 populator path) + a few sleep/checkin rows; call generator; assert context weeks non-empty, aiEval = fake text, status ready.
  - `testGenerate_shouldSkip_whenStatusReady` (idempotency), `testGenerate_shouldPersistFailed_whenLlmThrows` (fake supports error injection — check its idiom; context still persisted), `testGenerate_shouldLeavePendingAndWriteContext_whenSwitchOff` (`@TestPropertySource` off — NOTE: gets its own Testcontainers DB, keep it a separate test class `MesoReviewSwitchOffIT` if the base class requires it; check how `ClosingBlockSwitchOffIT` does it and mirror), and an event-flow test: close a run through the API → await (Awaitility, already used by async listener tests — grep for `await()` in companion ITs) status ready.
- [ ] **Step 2:** `./mvnw clean test -Dtest='MesoReviewGeneratorIT'` — FAIL. **Step 3:** Implement. **Step 4:** `./mvnw clean test -Dtest='MesoReviewGeneratorIT,MesoReviewSwitchOffIT,MesocycleCloseReportIT,ArchitectureTest'` — PASS (ArchitectureTest guards the cycle rule: companion→train only). **Step 5:** Commit `feat(companion): meso review generator — context buckets + one-shot AI eval (mezo-meyc.3)`.

### Task 16: FE — context + AI sections on the report page

**Files:**
- Modify: `frontend/src/features/train/pages/MesoReportPage.tsx` — add: context block (weekly cards: Alvás / Fuel / Checkin / Súly / Egyéb terhelés — render a compact per-week row list + totals line; hide any metric whose values are all null; whole block hidden when `context == null`), AI block (`aiEvalEnabled=false` ⇒ nothing; `pending` ⇒ spinner line „AI-kiértékelés készül…" while the hook polls; `ready` ⇒ the prose in a card + generatedAt caption + „Újragenerálás" ghost button; `failed` ⇒ „Újrapróbálás" button → `regenerate`)
- Modify: `frontend/src/data/train/train.ts` (`mesoReportMock` gains a full `context` with 8 weeks + totals and a 2-3 paragraph Hungarian `aiEval` text)
- Modify: MSW report handler (context + ai fields)
- Tests: extend `MesoReportPage.test.tsx` (three AI states + hidden-when-disabled + context rendering)

- [ ] Failing tests → implement → data touched ⇒ FULL both-mode suite + build → commit `feat(train): report page context + AI evaluation sections (mezo-meyc.3)`.

### Task 17: S3 docs + Ship

- [ ] Update `docs/features/train.md` (report page AI/context sections, event, endpoints' final semantics) AND `docs/features/companion.md` (MesoReviewGenerator + assembler + gate, one-shot inventory entry); roadmap; `node scripts/lint-docs.mjs`; commit `docs: meso AI review + context snapshot (mezo-meyc.3)`.
- [ ] **Ship protocol** for `feat/meso-ai-review`; `bd close mezo-meyc.3` + union-export verify.

---

# Slice S4 — compare view (`mezo-meyc.4`, branch `feat/meso-compare`)

### Task 18: FE — compare page + history selection + key results on cards

**Files:**
- Create: `frontend/src/features/train/pages/MesoComparePage.tsx` (route `/train/mesocycles/compare` in `router.tsx`, full-screen sibling; reads `?a=&b=` via `useSearchParams`, fetches both via two `useMesoReport` calls)
- Create: `frontend/src/features/train/logic/mesoCompare.ts` — pure helpers + colocated `mesoCompare.test.ts`:
  - `alignVolumeWeeks(a: MesoReport, b: MesoReport): {muscle: string, weeks: {week: number, aPlanned?: number, aActual?: number, bPlanned?: number, bActual?: number}[]}[]` (union of muscles; W1..max(weeks) aligned by index)
  - `sharedStrengthDeltas(a, b): {exerciseName: string, muscle: string, aDeltaKg?: number, aDeltaPct?: number, bDeltaKg?: number, bDeltaPct?: number}[]` (match by catalogId else exact name; sorted by |max pct| desc)
  - `contextDiff(a, b): {label: string, aValue?: number, bValue?: number, unit: string}[]` (totals: alvás h, kcal, energia, stressz, súlyváltozás, sport perc)
- Modify: `frontend/src/features/train/pages/MesocycleLibraryPage.tsx` — Történet header gains „Összevetés" toggle: selection mode, tap two closed runs → navigate to compare; history cards show key results when `hasReport` (adherence % + top strength jump — needs the report? NO extra fetch: extend `MesocycleResponse` consumption only with what's there; render adherence/top-jump from the report ONLY on the compare/report pages, and on the card show `closedAt` + „riport →" chip when `hasReport`, else „nincs riport" ghost — YAGNI on a batch-report endpoint)
- Tests: `MesoComparePage.test.tsx` (mock: two fixture reports — add a second archived run + report fixture `meso-hyp-03` to `train.ts` so compare has real mock data; MSW: report handler serves by id)

**Page layout:** two-column header (title/dates/weeks each side) → adherencia sor (két % + session-számok) → volumen: muscle pill switch + per-week kettős oszlopdiagram vagy egyszerű táblázat (reuse DS tokens; a simple `.compare-grid` table is fine — no new chart lib) → közös gyakorlatok erő-deltái (sor: név, A delta, B delta, jobb oldal kiemelve sage-dzsel) → kontextus-átlagok táblázat. Empty states: run without report → „Előbb generálj riportot" + link.

- [ ] Failing tests (logic helpers exact-value tests + page rendering from two mock reports + library selection navigation) → implement → data touched (fixtures) ⇒ FULL both-mode suite + build → commit `feat(train): two-run compare view (mezo-meyc.4)`.

### Task 19: S4 docs + Ship

- [ ] `train.md` (§2 compare surface + history selection, §10), roadmap (epic done), lint clean; commit `docs(train): meso compare view (mezo-meyc.4)`.
- [ ] **Ship protocol** for `feat/meso-compare`; `bd close mezo-meyc.4 mezo-meyc` (epic too) + union-export verify.

---

## Plan self-review notes (already applied)

- Spec §1–§5 → Tasks 1–8 (S1), 9–13 (S2), 14–17 (S3), 18–19 (S4); spec's context schema is declared in S2's contract task so S3 stays backend+FE-section only.
- The removed `POST /api/train/mesocycles` fallout is explicitly owned: backend Task 4 Step 5 (grep), FE Tasks 5/6 (planner + MSW + hooks migration).
- `MesoWeeks` is package-private in train — companion re-derives the week formula inline (Task 15) instead of importing it.
- Visual goldens are deliberately excluded from task gates and handled once per slice at ship time (Ship protocol step 4).
