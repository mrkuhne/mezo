---
title: Platform · API Contract & Backend Architecture
type: feature-platform
status: done
updated: 2026-06-25
tags: [platform, backend, data-layer, frontend]
key_files:
  - api/openapi.yml
  - api/generate
  - backend/src/main/java/io/mrkuhne/mezo
  - backend/pom.xml
  - backend/src/main/resources/messages.properties
  - frontend/src/lib/api.ts
  - frontend/src/lib/pantryApi.ts
  - frontend/src/data/hooks.ts
related: [_platform-data-layer, _platform-auth-security, train, today, fuel]
---

# Platform · API Contract & Backend Architecture — Feature Documentation

> One-line: the contract-first OpenAPI pipeline (`api/`) + the Spring Boot 4 backend spine (`backend/`) + the frontend consumption seam (`frontend/src/lib/*`, `frontend/src/data/hooks.ts`). **Status ✅ done as Phase-2 infrastructure** for auth · biometrics · goal · Train · **Fuel Pantry (Kamra)**; the durable backbone every backed feature flows through. Not a route/tab — it underlies all of them.

This is the platform doc: read it before, or alongside, any per-feature backend doc (auth, biometrics, goal, Train, Fuel). **Fuel's Pantry/Kamra sub-slice is now backed** (slice C, `mezo-9xu`); the rest of Fuel + Insights + People are still 🔶 mock-only and will *adopt* this spine when they leave mock status; Phase-3 AI is 🟣 deferred.

---

## 1. Summary

The FE↔BE boundary is defined **once**, in OpenAPI, under `api/`. Per-feature fragments (`api/feature/<x>/<x>.yml`) are merged into a single committed `api/openapi.yml`, which is the source of truth for **both** generators:

- the backend `openapi-generator-maven-plugin` (`spring` generator) emits controller interfaces (`io.mrkuhne.mezo.api.controller.<Tag>Api`) + request/response DTOs (`io.mrkuhne.mezo.api.dto.*`) at `generate-sources`;
- the frontend `openapi-typescript` emits `frontend/src/lib/api.gen.ts` (types only).

Drift between the two sides becomes a **compile error**, not a runtime surprise. On the backend each feature follows a fixed `feature/<name>/{controller,service,repository,entity,mapper}` layout on top of reusable `techcore/` building blocks: UUID-PK soft-deleted *owned* entities, single-user ownership resolved from the JWT principal, a `SystemMessage`-based error contract, and an integration-first test framework.

**Status per layer:**

| Domain | Contract fragment | Backend | FE wiring | Status |
|---|---|---|---|---|
| **Auth** | `api/feature/auth/auth.yml` | ✅ `feature/auth` | `lib/auth.ts` (`bootstrapOwnerToken`) | ✅ Real. Single-user thin auth, JWT HS256. |
| **Biometrics — weight** | `api/feature/weight/weight.yml` | ✅ `feature/biometrics/weight` | `lib/biometricsApi.ts` → `useWeight()` | ✅ Real, dual-mode. G5 (`mezo-g1u`) adds the live `GET /api/biometrics/weight/trend` (EWMA series + rate + sufficiency) via `WeightTrendService`; FE swap of the `weightTrends` mock is G5 Task 11. |
| **Biometrics — sleep** | `api/feature/sleep/sleep.yml` | ✅ `feature/biometrics/sleep` | `lib/biometricsApi.ts` → `useSleep()` | ✅ Real, dual-mode. |
| **Biometrics — check-in** | `api/feature/checkin/checkin.yml` | ✅ `feature/biometrics/checkin` | `lib/biometricsApi.ts` → `useCheckins()` | ✅ Real (mutation fires real in non-mock; read stays local state). |
| **Biometrics — profile** | `api/feature/biometrics-profile/biometrics-profile.yml` | ✅ `feature/biometrics/profile` | `lib/biometricProfileApi.ts` → `useBiometricProfile()` + `useBiometricActions()` (G6) | ✅ Real, dual-mode (G1, `mezo-2hp`; **wired G6 `mezo-06n`**). **G6**: the GET now carries a **derived** `tdeeBootstrap` (base-TDEE from the profile + latest weigh-in via `TdeeBootstrapService.compute`; cross-`$ref` to the goal fragment's `TdeeBootstrap`; NOT persisted, null with no weigh-in), and `BiometricProfileService.upsertProfile` **recomputes the owner's active goal** (the biometric-profile-change engine trigger, the engine's **5th recompute trigger** — see [`goal-engine.md`](goal-engine.md) §3). FE: the Profil "Biometria" card + `BiometricSheet` editor consume the two hooks (read 404→null, base-TDEE display; write invalidates `['biometricProfile']`+`['goals']`), and a complete profile is the hard gate on goal creation. |
| **Goal** (`Cél`) | `api/feature/goal/goal.yml` | ✅ `feature/goal` | `lib/goalApi.ts` + `lib/goalLinkApi.ts` → `useGoal()` (read) + `useGoalActions()` (G4b mgmt) + `useGoalCreation()` (G4a write) | ✅ Real (G1 `mezo-2hp` + G3 `mezo-3sc` + G4a `mezo-pqt` + G4b `mezo-tji`). CRUD + activate/archive lifecycle; G3 adds the `goal_plan_link` aggregate (timeline + attach/detach). FE reads active goal + real linked plans; **G4a wires the first write** — `useGoalCreation` POSTs a new goal (+ `biometric_profile` upsert + optional activate) via the `GoalPlanner` wizard; **G4b wires the command-center management** — `useGoalActions` drives archive/delete + plan attach/detach (FE-only over the existing endpoints), and adds the goal-upsert **inverted-window guard** in `GoalService` (see §4d). **G5 (`mezo-g1u`) lands the TDEE/prescription engine + its live HTTP surface** — `POST /api/goals/{id}/evaluate` (`GoalController` → `GoalEngineService.evaluate`) assembles + persists the segmented `prescription` + `tdeeBootstrap` jsonb onto the goal and re-fetches via `getGoal` (the `GoalMapper` projects both into `GoalResponse`); the no-profile case returns **200 with a graceful feasibility note** (never a 4xx, so the recompute triggers don't break), a foreign/missing goal still 404s. **G6 (`mezo-06n`)** derives the goal's target pace server-side: `GoalService.applyUpsert` computes `rateTargetPctPerWeek` from the target weight+date, so it was **dropped from `GoalUpsertRequest`** (still on `GoalResponse`); a new stateless `POST /api/goals/feasibility-preview` (`GoalFeasibilityService`) returns the derived %BW/wk pace + a verdict + a cap-paced realistic-date suggestion, with the verdict band shared (`verdictForRate`) between the preview and `GoalEvaluationService.gradeRate`. The band (≤`targetPctPerWeek` 0.7 → feasible · ≤`capPctPerWeek` 1.0 → feasible-with-warnings · over → aggressive) lives in exactly **one** method — `GoalFeasibilityService.verdictForRate` (single source of truth) — so the wizard's live preview and the persisted eval gate can never diverge. FE: the 2-step `GoalPlanner` wizard + the live feasibility preview in the cél step consume it (`useGoalCreation` no longer PUTs the profile; `useFeasibilityPreview`). |
| **Train** (meso · workout-exec · sport · catalog · records · running) | `api/feature/train/train.yml` | ✅ `feature/train` | `lib/trainApi.ts` + `lib/runningApi.ts` → `trainHooks.ts` / `runningHooks.ts` | ✅ Real, dual-mode. |
| **Fuel — Pantry (Kamra)** | `api/feature/pantry/pantry.yml` | ✅ `feature/pantry` | `lib/pantryApi.ts` → `usePantry()` + `usePantryActions()` | ✅ Real, dual-mode (slice C, `mezo-9xu`). Single `pantry_item` table (Model B), `kind` discriminator, kind-split projection — see §4c. |
| **Fuel** (rest — day/timeline/week, recipes, stack, protocol) | — | ❌ | `data/fuel.ts`, `data/pantry.ts`, `data/fuelWeek.ts` | 🔶 mock-only. |
| **Progression** (skill XP · level-up ledger · perk unlocks) | `levelUp` field on the **Train** `WorkoutInstanceResponse` (gym finish) + `RunSessionLogResponse` (run log) + own fragment `api/feature/progression/progression.yml` (`GET /api/progression/profile`, P4) | 🟡 `feature/progression` — P1 foundation + **P2 gym engine** + **P3a run engine** + **P3b sport engine** + **P4 profile API** | — (FE still mock; cards wire in P6) | 🟡 P1+P2 (gym) + P3a (run) + **P3b (sport)** + **P4 (profile)** done (`mezo-8e4`): curve math, 3 owned tables, entities/repos, perk catalog, the shared `award(...)` tail, `Gym`/`Run`/`SportSignalCalculator` + `ProgressionService.applyGym`/`applyRun`/`applySport`, the switch-gated `finishWorkout`/`logSession`/`logSportSession` triggers returning `levelUp`, and the switch-gated `ProgressionController` read surface (`getProfile`). FE cards + dual-mode mock (P6) remain. See §4e. |
| **Insights** | — | ❌ | `data/insights.ts` | 🔶 mock-only. |
| **People** | — | ❌ | `data/people.ts` | 🔶 mock-only. |
| **AI brain** (Spring AI, pgvector, RAG) | — | ❌ | — | 🟣 Phase-3 deferred. |

Confirmed by grep: only `data/hooks.ts`, `data/trainHooks.ts`, `data/runningHooks.ts`, `data/weightHooks.ts`, `data/biometricHooks.ts`, `data/goalHooks.ts`, `data/pantryHooks.ts` reference `isMockMode`; `fuel.ts`/`insights.ts`/`people.ts`/`pantry.ts` (the static seeds) contain **no** `apiFetch` (real Pantry traffic flows through `lib/pantryApi.ts`, not the `data/pantry.ts` seed). `api/base.yml` `info.title` is "mezo API".

**Driving specs/ADRs:** Phase-2 design `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`; deploy ADR `docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md`; roadmap `docs/milestones/roadmap.md`. House standards: `docs/references/*.md` (all linked below).

---

## 2. User-facing behavior

This is infrastructure — it has no direct UI. Its observable behavior is **the wire**:

- **Auth bootstrap (no login UI in Phase 2).** A single owner exists; the frontend bootstraps a JWT from env (`VITE_OWNER_EMAIL`/`VITE_OWNER_PASSWORD`) via `lib/auth.ts#bootstrapOwnerToken` → POST `/api/auth/login` → `setToken` in `lib/api.ts`. Every subsequent request carries `Authorization: Bearer <token>`.
- **Real-mode data** is fetched live (empty backend → `null` → views ghost-guard). **Mock-mode** (`VITE_USE_MOCK=true`) serves synchronous static data with no backend — the seam each feature toggles is `isMockMode()` inside its hook.
- **Error surface.** A failed request throws `ApiError` (`messages: SystemMessage[]`, `status`); the user-facing text is resolved server-side from message codes — there is no hardcoded English/Hungarian text on the wire, only stable codes (`AUTH_LOGIN_INVALID_CREDENTIALS`, `VALIDATION_REQUIRED_FIELD`, …).

For the actual screen flows that *consume* this spine, see the per-feature docs (Today/Mai, Me/Én, Train/Edzés).

---

## 3. Architecture & data flow

```
                          api/feature/<x>/<x>.yml   (per-feature OpenAPI fragment — write FIRST)
                                   │  openapi-merge-cli  (api/generate/merge.yml)
                                   ▼
                          api/openapi.yml            (committed merged contract — source of truth)
                ┌──────────────────┴───────────────────┐
   openapi-generator (spring)                 openapi-typescript
   @ mvn generate-sources                     @ pnpm generate:api
                │                                       │
   io.mrkuhne.mezo.api.controller.<Tag>Api      frontend/src/lib/api.gen.ts (committed)
   io.mrkuhne.mezo.api.dto.*  (target/, gitignored)    │
                ▼                                       ▼
   Controller implements <Tag>Api          lib/<x>Api.ts  (request bodies `satisfies <Request>`)
        → Service (@Transactional writes)         │  apiFetch (lib/api.ts) + Bearer token
        → Mapper (MapStruct entity↔dto)           ▼
        → Repository (OwnedRepository)      data/hooks.ts  ── isMockMode() ──┐
        → Entity (OwnedEntity, @SQLDelete)         │  real                   │ mock
        → Liquibase DDL (ddl-auto: validate)       ▼                         ▼
                ▼                            apiFetch → backend         static initialData
            PostgreSQL                                                  (TanStack Query)
```

**The view→DB path, traced (weight slice, the smallest full CRUD):**

- View → `useWeight()` (`frontend/src/data/weightHooks.ts:11`) → `weightApi` (`frontend/src/lib/biometricsApi.ts`) → `apiFetch` (`frontend/src/lib/api.ts`) → `POST /api/biometrics/weight` / `GET /api/biometrics/weight`.
- Backend: `WeightLogController implements WeightApi` (`feature/biometrics/weight/controller/WeightLogController.java`) → `WeightLogService` → `WeightLogMapper` → `WeightLogRepository extends OwnedRepository<WeightLogEntity>` → `WeightLogEntity` → table `weight_log`.

**Dual-mode behavior** (the FE seam): `isMockMode()` (`frontend/src/lib/mode.ts`, reads `VITE_USE_MOCK`, default mock) switches each hook between mock static data (TanStack Query `initialData`, synchronous, no network) and the real `*Api` client. Real-mode mutations `invalidateQueries`; mock-mode mutations emulate the server via `queryClient.setQueryData`. **Hook signatures are the FE's own stable contract and are NOT generated** — only the DTOs/types crossing the wire are.

---

## 4. Data model & API

### 4a. The contract layer (`api/`)

- `api/base.yml` — `info` / `servers` (`http://localhost:8090`) / global `bearerAuth` security; `paths: {}`. Merge base — its info/servers/security win.
- `api/common/common-schemas.yml` — `SystemMessage` (fields `level` enum ERROR/WARNING/INFO, `code`, `params`, `message`, `fieldName`, `type` enum REQUEST/FIELD, `exceptionTraceId` uuid) + `SystemMessageList` (array). **Every non-2xx response references `#/components/schemas/SystemMessageList`.**
- `api/generate/merge.yml` — the ordered `inputs:` list (base → common → auth → weight → sleep → checkin → train → goal → biometrics-profile). **Forgetting to append a new fragment here silently drops it from the merge.**
- `api/generate/package.json` — `openapi-merge-cli ^1.3.2`, script `generate:api`.
- `api/openapi.yml` — committed merged output. `frontend/src/lib/api.gen.ts` is its committed TS projection (`components['schemas']['X']`, `operations`, `paths`).

**Fragment naming rules (load-bearing — generated names derive from them):**

- schema name = generated class name (`LogWeightRequest`, `WeightLogResponse`); requests end `Request`, responses `Response`;
- `operationId` = controller method name (`logWeight`);
- `tag` = generated interface name (tag `Weight` → `WeightApi`; tag `Train` → `TrainApi`).

**Validation lives in the spec** (`required`, `minLength`, `minimum/maximum`+`exclusiveMinimum`, `pattern`, `format`) → JSR-303 on the backend. Never hand-add validation the spec can express. Two codified gotchas: `@NotBlank` has no OpenAPI equivalent → `required` + `minLength: 1` (an empty string then fails as `Size`→`VALIDATION_INVALID_VALUE`, **not** `VALIDATION_REQUIRED_FIELD`, which only fires for null/missing); and **prefer `pattern` over `enum` on *request* fields** — an invalid enum fails Jackson deserialization (500), a `pattern` fails bean validation (400). Live: `SportScheduleSlotInput.kind` uses `pattern: '^(training|match)$'` on the request while the response variant uses `enum`.

### 4b. The persistence layer (every owned table)

UUID PKs (`id UUID DEFAULT gen_random_uuid()` in DDL; `@Id @GeneratedValue @Column(columnDefinition="uuid")` in Java). Every owned table carries `created_by uuid NOT NULL` (FK→`app_user(id) ON DELETE CASCADE`), `is_deleted boolean`, `created_at` — supplied by the `OwnedEntity` `@MappedSuperclass`. Soft delete via `@SQLDelete(... set is_deleted = true ...)` + `@SQLRestriction("is_deleted = false")`. Typed jsonb via `@JdbcTypeCode(SqlTypes.JSON)` onto a *typed record*, never `String` (live: `MesocycleEntity.volumeRecompute`→`VolumeRecomputeJson`, `RunningBlockEntity.structure`→`RunningBlockStructure`, and the signature provenance envelope `ProvenanceEnvelope` persisted as one jsonb column in `muscle_group_volume_log.source`). Typed Postgres `text[]` via `@JdbcTypeCode(SqlTypes.ARRAY)` (`MesocycleEntity.phaseCurve` and, G1, `GoalEntity.guards` — both `List<String>` so Hibernate dirty-checks element changes). **Not every owned aggregate uses `OwnedRepository`** — that superclass's `findAllOwned` requires an `e.date` field, so **date-less owned aggregates extend `JpaRepository` directly** with bespoke `findBy…CreatedByAndDeletedFalse` finders (G1's `GoalRepository`/`BiometricProfileRepository`; both entities still `extends OwnedEntity` for the ownership+soft-delete columns). **Additive fields on a jsonb-backed record need no migration** — e.g. `RunPrescribedSession.timeOfDay` (nullable `HH:mm`) was added straight onto `RunningBlockStructure` and rides the existing `running_block.structure` column; the only contract touch was `api/feature/train/train.yml` (`pattern: '^\d{2}:\d{2}$'`, `nullable`) regenerated into `api/openapi.yml`, with **no Liquibase changeset**. **Derived fields are computed server-side, never trusted from the request** (same principle as `created_by`): e.g. `currentWeek` is set to `clampWeek(startDate, weeks)` in both `TrainService` (mesocycles) and `RunningService` (blocks), and the running read path additionally heals a stale/out-of-range stored value (mezo-478).

### 4c. REST endpoints (backed features only)

| Method + path (prefix `/api`) | Tag/Api | Purpose |
|---|---|---|
| `POST /auth/login` | `AuthApi` | obtain JWT (public, `security: []`) |
| `POST /biometrics/weight`, `GET /biometrics/weight` | `WeightApi` | log / list weight |
| `POST /biometrics/sleep`, `GET /biometrics/sleep` | `SleepApi` | log / list sleep |
| `POST /biometrics/checkin` (+read) | `CheckInApi` | daily check-in upsert |
| `GET/PUT /biometrics/profile` | `BiometricProfileApi` | body-composition profile (one row/owner; G1) |
| `GET/POST /goals`, `GET/PUT/DELETE /goals/{id}`, `POST /goals/{id}/{activate,archive}` | `GoalApi` | goal CRUD + lifecycle (single-active enforced in service; G1) |
| `GET /goals/{id}/timeline`, `POST /goals/{id}/plans`, `DELETE /goals/{id}/plans/{linkId}` | `GoalApi` | goal-plan-link timeline / attach / detach (G3, `mezo-3sc`) — see §4d |
| `POST /goals/{id}/evaluate` | `GoalApi` | run the TDEE/prescription engine (G5, `mezo-g1u`) — persists `prescription`+`tdeeBootstrap`, no-profile → 200 feasibility note |
| `POST /goals/feasibility-preview` | `GoalApi` | stateless realism preview (G6, `mezo-06n`) — derived %BW/wk pace + verdict + cap-paced realistic date; `GoalFeasibilityService`, no persistence |
| Train surface (`/train/...`, running, sport, gym-schedule, catalog, records) | `TrainApi` (fans to 7 services) | see Train feature doc + `api/feature/train/train.yml` |
| `GET /pantry` | `PantryApi` | the owner's pantry, projected by `kind` into `{ ingredients, stash }` (food → ingredients; supplement/stim/med → stash) — Fuel slice C, `mezo-9xu` |
| `POST /pantry`, `PUT/DELETE /pantry/{id}` | `PantryApi` | add / update / soft-delete a pantry item; per-kind required-field validation in `PantryService.validatePerKind` (see the single-table note below) |

**The Pantry single-table model (Model B, `mezo-9xu`).** All pantry rows live in one `pantry_item` table (migration `db/changelog/1.0.0/script/202606221200_mezo-9xu_create_pantry_item.sql`), with a `kind` column (`food`/`supplement`/`stim`/`med`) acting as the discriminator. `feature/pantry/service/PantryService.getPantry` reads the owner's items once and **projects them by kind** into the `PantryResponse` shape `{ ingredients, stash }` — food rows map to `IngredientResponse`, supplement/stim/med rows to `SupplementStashResponse` (`PantryMapper`). Rather than DB CHECK constraints per kind, **per-kind required fields are validated in the service** (`PantryService.validatePerKind` — e.g. `food` needs macros/serving fields) so the single table stays flexible; entity micros are typed jsonb (`MicroFact` list via `@JdbcTypeCode(SqlTypes.JSON)`), with the usual UUID PK + `created_by` ownership + soft-delete columns. Scrape/import (`imports`), AI `suggestions`, recipe scoring, and pantry-logging are **deferred** — the read DTO carries `imports`/`suggestions` only as `[]` from the FE config side; the backend owns inventory CRUD only.

**Mock-only domains (no backend, no fragment):** the rest of Fuel (day/timeline/week, recipes, stack, protocol) lives in `frontend/src/data/fuel.ts` / `pantry.ts` (the static seed, distinct from the now-backed Pantry inventory) / `fuelWeek.ts`; Insights in `data/insights.ts`; People in `data/people.ts`. The backend will plug in by adding `api/feature/<x>/<x>.yml`, a `feature/<x>` backend package, and swapping the mock hook to dual-mode — exactly the recipe in §7. (`ProvenanceEnvelope`'s docstring already forward-references "Fuel reuses this pattern for meal score".)

### 4d. The goal-plan-link aggregate (G3 — timeline coupling, `mezo-3sc`)

The first **cross-feature** owned aggregate: it positions an owned *train* plan on a *goal*'s timeline. The table `goal_plan_link` (`db/changelog/1.0.0/script/202606181600_mezo-3sc_create_goal_plan_link.sql`) carries `goal_id` (FK→`goal ON DELETE CASCADE`), `plan_type` (CHECK `('mesocycle','running_block')`), `plan_id`, and a `[start_week, end_week]` 1-based span (CHECK `start_week >= 1 AND end_week >= start_week`), plus the usual `OwnedEntity` columns. Entity `feature/goal/entity/GoalPlanLinkEntity.java:29` — a **date-less owned aggregate**, so its repository `feature/goal/repository/GoalPlanLinkRepository.java:9` extends `JpaRepository` with bespoke `findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc` / `findByIdAndCreatedByAndDeletedFalse` finders (same pattern as `GoalRepository`).

Three endpoints fan off the existing `GoalController` (`feature/goal/controller/GoalController.java:64-76`) into two new services:

- **`GoalPlanLinkService`** (`feature/goal/service/GoalPlanLinkService.java`) — the write/resolve side. `attachPlan` (`:46`) ownership-checks the goal **and** the referenced plan, then derives `endWeek = startWeek + plan.weeks - 1` server-side (`:55`) — `end_week` is **never trusted from the request**, matching the `created_by`/`currentWeek` derived-field rule (§4b). `detachPlan` (`:60`) soft-deletes via `@SQLDelete` after a this-goal ownership filter. `resolvePlan` (`:69`) reads the train repos **READ-ONLY** to build the display `GoalPlanRef` (title/status/dates/weeks). **The only train-side change is one additive read finder** `MesocycleRepository.findByIdAndCreatedByAndDeletedFalse` (`feature/train/repository/MesocycleRepository.java:19`); the running counterpart already existed. Train behavior is unchanged.
- **`GoalTimelineService`** (`feature/goal/service/GoalTimelineService.java`) — the read assembly. `getTimeline` (`:43`) lists the links + resolves each plan-ref, then scans gym-lane coverage: only `mesocycle`-type links tile coverage (`:53`), running blocks are episodic, volleyball is ambient and never a link. Weeks no mesocycle spans become soft, non-blocking `GoalGap`s (`:62-73`); the window length is derived from the goal's `startDate..targetDate` span (`:84`), not stored. Pure read — no `@Transactional`.

**Goal-upsert inverted-window guard (G4b, `mezo-tji`/`mezo-b0k`).** `GoalService.applyUpsert` (`feature/goal/service/GoalService.java:94-101`) rejects an inverted window **up front**: when both dates are present and `targetDate.isBefore(startDate)`, it throws `SystemRuntimeErrorException(SystemMessage.field("VALIDATION_INVALID_VALUE", "targetDate"), HttpStatus.BAD_REQUEST)` → a **400 FIELD error on `targetDate`** for both POST `/goals` and PUT `/goals/{id}`. Before the guard, a `targetDate < startDate` upsert persisted, then the next `GoalTimelineService.getTimeline` derived a **negative** window length (`:84`) and blew up with a **500** — the guard moves the failure to the write boundary as a clean validation error. The `GoalPlanner` wizard already gates `targetDate > startDate` in the UI (`canNext`), so this is the server-side belt-and-braces; the date range itself stays expressible only in code (no OpenAPI cross-field constraint), so it lives in `applyUpsert`, not the spec. IT: `feature/goal/GoalServiceIT` covers the inverted-date 400.

`GoalPlanLinkMapper` (`feature/goal/mapper/GoalPlanLinkMapper.java:22`) maps `(entity, resolved GoalPlanRef) → GoalPlanLinkResponse`, converting the `String planType` to the generated inner enum via `fromValue`. **Cascade on goal delete** is handled in Java, not the DB FK: `GoalService.deleteGoal` (`feature/goal/service/GoalService.java:63-67`) soft-deletes the goal's links first (the FK `ON DELETE CASCADE` only fires on a *physical* delete, which the soft-delete path never triggers), so a re-used goal id never inherits ghost links. Demodata links the demo meso + running block to the demo goal (`feature/goal/GoalSeedData.java`, `demodata` profile). Contract fragment: the same `api/feature/goal/goal.yml` (POST `/plans` → **201**, DELETE `/plans/{linkId}` → **204**, GET `/timeline` → **200**; schemas `GoalPlanAttachRequest`/`GoalPlanLinkResponse`/`GoalPlanRef`/`GoalTimelineResponse`/`GoalGap`). ITs: `feature/goal/{GoalPlanLinkServiceIT,GoalTimelineServiceIT,GoalTimelineContractIT}.java`. FE read-side: `lib/goalLinkApi.ts` → `useGoal()` builds real `linkedMesocycles` + `goal.mesocycles` from the timeline (see Me feature doc + `_platform-data-layer.md`).

### 4e. The progression domain (P1 foundation + P2 gym-path + P3a run-path + P3b sport-path engines + finish/log triggers + P4 profile read surface, `mezo-8e4`)

> **Gym + run engines + their triggers landed; standalone HTTP read surface still deferred.** P1 landed the persistence + pure-logic spine for the skill-progression / "level-up" system; **P2 (gym path)** added the engine that *grants* XP — `GymSignalCalculator` (extracts a `GymSignal` from a finished gym instance) + `ProgressionService.applyGym` — and wired it into the gym finish flow (`WorkoutService.finishWorkout`). **P3a (run path)** extends the same engine to the RUN family: it first **extracted the GYM-agnostic tail of `applyGym` into a shared private `award(...)`** (the deltas→upsert→gains→perks→robustness→event→payload part, now reused by every family), then added `RunSignalCalculator` + `ProgressionService.applyRun` (see below) and wired it into the run-log flow (`RunningService.logSession`). The gym finish returns a `levelUp` on `WorkoutInstanceResponse`; **the run log now also returns a `levelUp` on `RunSessionLogResponse`** — both ride the existing Train contract (no new fragment), both behind the same `mezo.feature.progression.enabled` switch. **P3b (sport path)** generalized the `sport_session` entity into a 3-kind modality (the existing `sport` column became the `volleyball|cross|trx` discriminator via `ck_sport_session_sport`, plus a `rounds` effort column — `202606271000_mezo-lmox_…`) and added `SportSignalCalculator` + `ProgressionService.applySport`, wired into the sport-log flow (`SportService.logSportSession` now returns a `levelUp` on `SportSessionResponse`). P3b also **lifted the robustness rate out of `gym()` into a shared `mezo.progression.robustness` node** and hardened `RunSignalCalculator` to load its log via an ownership-scoped finder. **P4 (profile read surface)** added the first `api/feature/progression/progression.yml` fragment (`GET /api/progression/profile`) + a switch-gated `ProgressionController` → `ProgressionService.getProfile` (athlete-level, 6 radar axes, streak, highlights — see below). The frontend's progression views stay mock-only until **P6** (the profile contract exists but has no FE consumer yet). So progression now contributes the `levelUp` field on the Train contract **and** its own profile fragment to `api/openapi.yml` / `frontend/src/lib/api.gen.ts`.

`feature/progression` ships:

- **Pure level math** — `ProgressionCurve` (`feature/progression/ProgressionCurve.java`): `xpThreshold(level)` (cumulative XP to BE at a level; `level ≤ 1 → 0`), `levelFor(cumulativeXp)` (highest reached level, capped at `MAX_LEVEL = 200` via the scan guard), `progressPct(cumulativeXp, level)` (within-level fill 0..100, with a `ceil ≤ floor` divide-by-zero guard returning 100). Tuned by `ProgressionProperties` (`mezo.progression.curve.{base,exp}`, defaults 100 / 1.6 — `@Validated` record, never `@Value`). No state, no DB. Spec'd by `ProgressionCurveTest` (plain JUnit, no Spring context).
- **In-memory perk catalog** — `PerkCatalog` (`feature/progression/PerkCatalog.java`): master content (skillKey + milestoneLevel → perk title/effect copy) loaded at startup from the classpath `content/progression-perks.json`, **no table / no `created_by`** (the per-user unlocks live in `perk_unlock`). Invalid content **fails startup fast** (`@PostConstruct validate`). IT: `PerkCatalogIT`.
- **Three new owned tables** (migration `db/changelog/1.0.0/script/202606251200_mezo-8e4_create_progression.sql`), all the usual UUID-PK + `created_by` FK→`app_user ON DELETE CASCADE` + soft-delete columns:
  - **`skill_progress`** — per-skill XP accumulator: `skill_key`, `skill_kind` (`ATHLETIC|MUSCLE`, DB CHECK), `cumulative_xp` (bigint), `current_level` (int, CHECK ≥ 1); idempotency key `uq_skill_progress_created_by_skill_key` (one row per skill per owner). Entity `entity/SkillProgressEntity.java` (`@UpdateTimestamp updated_at`).
  - **`level_up_event`** — the XP-grant ledger: one row per XP-granting workout regardless of whether a level was crossed. `source_type` (`GYM|SPORT|RUN`, DB CHECK), **`source_ref_id` UUID** — a *polymorphic* ref to the gym instance / sport / run session, **intentionally NOT an FK** (no single parent table to point at); `total_xp` (bigint); `payload` typed jsonb (`LevelUpResult` record via `@JdbcTypeCode(SqlTypes.JSON)`). **Idempotency key `uq_level_up_event_created_by_source` (`created_by, source_type, source_ref_id`)** — re-processing the same workout cannot double-grant. Entity `entity/LevelUpEventEntity.java`.
  - **`perk_unlock`** — per-user perk unlocks: `skill_key`, `perk_key`, `milestone_level` (CHECK ≥ 1); idempotency key `uq_perk_unlock_created_by_perk`. Entity `entity/PerkUnlockEntity.java`.
- **Repositories** — `repository/{SkillProgressRepository,LevelUpEventRepository,PerkUnlockRepository}.java`, date-less owned aggregates extending `JpaRepository` with bespoke `…CreatedByAndDeletedFalse` finders (same pattern as `GoalRepository`, §4b).
- **Test populators** — `support/populator/{SkillProgressPopulator,LevelUpEventPopulator}.java` (one per persisted aggregate; `perk_unlock` is exercised through the persistence IT directly). The three tables are in the `ResetDatabase` TRUNCATE list (§8). ITs: `feature/progression/{ProgressionPersistenceIT,ProgressionPopulatorIT}.java`.
- **Shared award tail (P3a)** — `service/ProgressionService.award(createdBy, sourceType, sourceRefId, deltas, kinds, label, durationMin, rpe) → LevelUpResult` (private; P3a extracted it from `applyGym`'s tail so every family reuses it). It runs **inside the caller's `@Transactional`** (no own `@Transactional`) and is the **family-agnostic** pipeline: **idempotency guard** at its top (`(sourceType, sourceRefId)` lookup on `level_up_event` → return the **stored `payload`** without re-awarding), then apply the per-skill XP `deltas`/`kinds` → `upsert skill_progress`, build gains + level-ups (`ProgressionCurve.levelFor`) + perks (unlock once per `perk_key` at every milestone strictly crossed 5/10/15/20/25/30 via `PerkCatalog.find`), recompute streak **robustness** (streak-only **absolute target** `streakWeeks*perWeekXp`, recomputed each apply → idempotent within a week; the rate is read from the family-agnostic `properties.robustness()` node — **lifted out of `gym()` in `mezo-lmox`** now that all three families feed it), and persist exactly one `level_up_event`. Streak comes from `service/RobustnessCalculator.streakWeeks` — consecutive ISO weeks (Europe/Budapest) with ≥1 logged gym instance / sport / run, gathered via `WorkoutSessionRepository.findInstanceDates`, `SportSessionRepository...OrderByDateDesc`, `RunSessionLogRepository...OrderByDateDesc` (known v1 limitation: the week-key walk-back under-counts across ISO-year boundaries).
- **Gym-path XP engine (P2)** — `service/ProgressionService.applyGym(createdBy, GymSignal) → LevelUpResult` (`@Transactional`, `@Service`): builds the GYM-specific deltas from `ProgressionProperties.gym()` (muscle `volume/volumeUnit*volumeXpPerUnit`, integer; `max_strength = bestE1rm.intValue()*e1rmXpPerKg + prBonusXp` where the **v1 PR rule** awards the bonus only on the **first-ever weighted session** — no prior `max_strength` row; `strength_endurance = workSetCount*xpPerSet + bodyweightRepCount*xpPerRep`), then delegates the whole tail to `award(createdBy, "GYM", signal.instanceId(), …)`. Idempotent per `(GYM, instanceId)` (via `award`'s guard). IT: `feature/progression/service/ProgressionServiceIT` (3 tests: first-apply XP/level-up, idempotency, prior-row PR rule).
- **Run-path XP engine (P3a)** — `service/ProgressionService.applyRun(createdBy, RunSignal) → LevelUpResult` (`@Transactional`): builds the RUN deltas from `ProgressionProperties.run()`, then delegates to `award(createdBy, "RUN", signal.logId(), …)`. Idempotent per `(RUN, logId)` (every run-log POST is a new row, so each genuinely-distinct log grants once). All RUN skills are `ATHLETIC` — **run grants no muscle XP**. The branch keys off the signal's **kind** (`sprint`/`pyramid` → sprint scoring; everything else → steady; `pyramid` is scored as sprint): **sprint** → `sprint_speed = rounds*sprintXpPerRound`, `anaerobic_capacity = rounds*anaerobicXpPerRound`, `explosiveness = rpeActual*rpeXpPerPoint`; **steady** → `strength_endurance = min*steadyXpPerMin`, `aerobic_capacity = min*aerobicXpPerMin + (hrRecoverySec present ? hrRecoveryBonusXp : 0)`. A private `addAthletic` helper only adds positive deltas (no 0-XP gains), so any null/zero metric simply drops its skill. The signal comes from **`run/RunSignalCalculator.compute(createdBy, runLogId)`** (`@Component`): it reads the saved `run_session_log` row and **resolves the prescribed session's `kind`** by walking the owning `running_block`'s typed-jsonb `structure` (weeks → sessions, matched by `sessionKey`; **defaults to `steady`** when the block/structure/session is missing). `RunSignal` carries `(logId, kind, completedRounds, durationMin, rpeActual, sprintLandmark, hrRecoverySec)` — `sprintLandmark` is plumbed but **not yet consumed** (reserved for a future sprint-scoring refinement). Config: `ProgressionProperties.Run` (added to the existing `mezo.progression` record, not a new `*Properties`) — `sprintXpPerRound`/`anaerobicXpPerRound`/`steadyXpPerMin`/`aerobicXpPerMin`/`rpeXpPerPoint`/`hrRecoveryBonusXp` (defaults 25/15/4/5/6/30). ITs: `feature/progression/run/RunSignalCalculatorIT` (sprint kind + field mapping, default-to-steady) + `feature/progression/service/ProgressionRunIT` (sprint skills, steady skills, idempotency).
- **Sport-path XP engine (P3b)** — `service/ProgressionService.applySport(createdBy, SportSignal) → LevelUpResult` (`@Transactional`): builds the SPORT deltas from `ProgressionProperties.sport()`, then delegates to `award(createdBy, "SPORT", signal.sessionId(), …)`. Idempotent per `(SPORT, sessionId)`. All SPORT skills are `ATHLETIC` (no muscle XP). The branch keys off the **kind** (the `sport` column, `volleyball|cross|trx`): **volleyball** → `vertical_jump`/`agility`/`coordination = setsPlayed*xpPerSet`, `explosiveness = rpe*rpeXpPerPoint`, `aerobic_capacity = min*xpPerMin`; **cross** → `anaerobic_capacity`/`strength_endurance = rounds*xpPerRound`, `explosiveness`/`core_stability = rpe*rpeXpPerPoint`; **trx** → `core_stability`/`strength_endurance = rounds*xpPerRound`, `anaerobic_capacity = rpe*rpeXpPerPoint`, `mobility = min*xpPerMin`. (Volleyball scores off the logged `setsPlayed`, not `jumpCount`.) The signal comes from `sport/SportSignalCalculator.compute(createdBy, sessionId)` (`@Component`) — an **ownership-scoped** load of the just-saved `sport_session` row, rounding its `BigDecimal` RPE HALF_UP to an `Integer`. `SportSignal` carries `(sessionId, kind, durationMin, setsPlayed, rounds, rpe)`. Config: `ProgressionProperties.Sport` (`xpPerSet`/`xpPerRound`/`xpPerMin`/`rpeXpPerPoint`, defaults 12/14/4/6). ITs: `feature/progression/sport/SportSignalCalculatorIT` (cross metrics + RPE rounding + owner scoping) + `feature/progression/service/ProgressionSportIT` (volleyball/cross/trx skills, idempotency).
- **Gym finish + run log + sport log triggers (P2/P3a/P3b, switch-gated)** — both attach the `levelUp` **only** when the progression feature switch is on, each inside the host write's existing `@Transactional` (atomic with the save). The switch is read the house way — **no `@Value`/`Environment`**: a marker bean `feature/progression/ProgressionGate.java` (`@Component @ConditionalOnProperty(name = FeaturesConfiguration.PROGRESSION_SWITCH /* mezo.feature.progression.enabled */, havingValue = "true")`, no `matchIfMissing`) exists **only** when the property is `true`; the host services inject it via `ObjectProvider<ProgressionGate>` and `getIfAvailable() != null` ⇔ switch on. **Gym:** `WorkoutService.finishWorkout` runs `GymSignalCalculator.compute` → `applyGym` → `LevelUpResultMapper.toDto` → `setLevelUp` on `WorkoutInstanceResponse` (the shared `toInstanceResponse` is **unchanged**, so `startWorkout`/resume never carry a `levelUp`; idempotent on the instance id, so a re-finish does not double-award). **Run:** `RunningService.logSession` runs `RunSignalCalculator.compute(userId, savedLogId)` → `applyRun` → `LevelUpResultMapper.toDto` → `setLevelUp` on `RunSessionLogResponse` (only on the POST/save path, never the GET list; idempotent on the saved log id). **Sport:** `SportService.logSportSession` runs `SportSignalCalculator.compute` → `applySport` → `LevelUpResultMapper.toDto` → `setLevelUp` on `SportSessionResponse` (POST only, never the GET list; idempotent on the saved session id). Contract ITs: `feature/train/WorkoutFinishLevelUpApiIT` (gym finish → `levelUp` source GYM, totalXp > 0, a `chest` gain) + `feature/train/RunSessionLevelUpApiIT` (sprint run log → `levelUp` source RUN, a `sprint_speed` gain); sport is covered service/contract-side by `feature/train/SportServiceIT` (volleyball log → `levelUp` source SPORT, cross kind+rounds persisted) + `feature/train/SportContractIT` (cross without volleyball fields → 201 + `levelUp`, bad `sport` → 400).
- **Profile read surface (P4)** — `controller/ProgressionController.java` (`@RestController implements ProgressionApi`, gated by `@ConditionalOnProperty(PROGRESSION_SWITCH, havingValue = "true")` — the **first** switch-gated controller; absent → `GET /api/progression/profile` 404s) → `ProgressionService.getProfile(createdBy)` (a pure read, **no** `@Transactional`). It reads all `skill_progress` rows and aggregates over the fixed `ProgressionTaxonomy` (11 non-robustness athletic + robustness; 13 muscle tokens): each `SkillLevel` derives a level (**missing row → level 1**) + `progressPct`; **athleteLevel** = mean of the 11 non-robustness athletic levels (1-decimal, `null` when the user has **zero** rows → ghost); **6 fixed radar axes** (Robbanékonyság/Sebesség/Állóképesség/Mozgékonyság/Koordináció regroup the 11; **Erő** blends `max_strength` with the muscle-level mean via `mezo.progression.radar.strength-muscle-blend`, default 0.5); **streakWeeks** from `RobustnessCalculator`; **highlights** = best existing athletic (excl. robustness) + best muscle by `(level, cumulativeXp)`. Contract: the first `api/feature/progression/progression.yml` fragment (tag `Progression` → `ProgressionApi`; `getProfile` → `ProgressionProfileResponse {athleteLevel?, streakWeeks, athletic[], muscle[], radarAxes[], highlights}`). ITs: `feature/progression/service/ProgressionProfileServiceIT` (ghost, athlete-level over the 11, Erő muscle-blend, robustness excluded) + `controller/ProgressionProfileApiIT` (HTTP ghost + 401) + `controller/ProgressionProfileSwitchOffApiIT` (switch-off → 404).
- **FE consumer (P5, `mezo-te8k` — frontend-only)** — the `levelUp` on the three finish responses is no longer discarded: the gym `finishWorkout` + the sport/run log mutations now **forward the response**, and all three flows present it through a **single host** — `LevelUpProvider`/`useLevelUp()` (`frontend/src/features/progression/`, mounted once in `AppLayout`) renders the full-bleed `LevelUpScreen` overlay (self-portaled into `.phone-screen`, above the TabBar+Fab; hand-rolled CSS keyframes, rAF count-up, **`prefers-reduced-motion` first-class** via `useReducedMotion`). The gym overlay layers over the existing `WorkoutComplete` recap (revealed on `Tovább`). Because the backend sends `gain.name = <raw skillKey>` and `gain.icon = null`, the **FE owns the HU display name + emoji** (`levelUpMeta.ts`; muscle names reuse Train's `MUSCLE_LABELS`). **Mock mode** can't compute a payload, so the no-op finish/sport/run mutations return deterministic seeded `LevelUpResult` fixtures (`frontend/src/data/progressionMock.ts`). See `docs/features/train.md` §2 (COMPLETE phase) + §5 (the level-up seam).
- **FE profile cards (P6, `mezo-xje5` — frontend-only; completes the `mezo-8e4` epic)** — the P4 `GET /api/progression/profile` now has an FE consumer: a dual-mode `useProgressionProfile()` hook (`frontend/src/data/progressionHooks.ts` + `lib/progressionApi.ts`) feeds two cards in the Me/Profile view (`frontend/src/features/me/components/{AthleticRadarCard,MuscleLevelsCard}.tsx`) — a hand-rolled SVG hexagon radar of the 6 server-computed `radarAxes` + athlete-level/best/streak stats, and a top-N muscle-levels card + reserve note. Both ghost on `athleteLevel == null` (no XP / switch-off 404); mock returns a seeded `progressionProfileMock`. The radar reuses the P5 `useReducedMotion`. **With P6 the `mezo-8e4` progression epic (P1 domain → P2 gym → P3a run → P3b sport → P4 profile API → P5 level-up overlay → P6 profile cards) is fully shipped.** See `docs/features/me.md` §2 (`Profil`) + §3.

---

## 5. Integrations

This is the most load-bearing section — every seam, bidirectionally, with the crossing type.

**Contract ↔ Backend (generate-sources seam).** `api/openapi.yml` → `io.mrkuhne.mezo.api.controller.<Tag>Api` (interfaces) + `io.mrkuhne.mezo.api.dto.*` (DTOs, under `target/generated-sources/openapi`, gitignored). Controllers `implements <Tag>Api`; services and mappers consume `api.dto` types directly (`LogWeightRequest`/`WeightLogResponse`, `MesocycleResponse`, …). **Crossing type:** every `*Request`/`*Response` schema. **Drift = compile error.** Generator config (`backend/pom.xml` lines ~175-215): `generatorName=spring`, `apiPackage=io.mrkuhne.mezo.api.controller`, `modelPackage=io.mrkuhne.mezo.api.dto`, `inputSpec=../api/openapi.yml`; `useSpringBoot4=true`, `interfaceOnly=true`, `skipDefaultInterface=true`, `useResponseEntity=false`, `useTags=true`, `openApiNullable=false`, `annotationLibrary=none`, and `additionalModelTypeAnnotations=@lombok.Builder @lombok.NoArgsConstructor @lombok.AllArgsConstructor` (so DTOs are builder-able — `LogWeightRequest.builder()` in tests, `WorkoutInstanceResponse.builder()` in services; generated enums expose `fromValue(...)`, used in mappers e.g. `MesocycleResponse.StatusEnum.fromValue(...)`).

**Contract ↔ Frontend (generate seam).** `api/openapi.yml` → `frontend/src/lib/api.gen.ts` via `openapi-typescript`. `lib/<x>Api.ts` clients use the types: request bodies are written `... satisfies <Request>`, responses typed with the generated response type and structurally assigned to the hook layer's domain types (e.g. `WeightLogResponse[]` is assignable to `WeightEntry[]`, checked by tsc). Where a domain type is stricter than the contract, the seam uses an **explicit documented cast** (e.g. `sleepApi.list` casting `SleepLogResponse[] as SleepEntry[]` with a TODO/bd note) — never a silent re-widen of `apiFetch<T>`. **Crossing type:** the same schema names, surfaced as TS types.

**Backend ↔ DB.** Entities ↔ Liquibase DDL stay in lockstep — every constraint mirrored both ways, enforced at startup by Hibernate `ddl-auto: validate` (Liquibase owns the schema, Hibernate never mutates it; `open-in-view: false`). jsonb columns ↔ typed records via `@JdbcTypeCode`.

**Auth ↔ every protected feature (the universal seam).** `AuthService` mints the JWT with `subject = app_user.id`; `CurrentUserId` (`techcore/security/CurrentUserId.java`) reads `SecurityContextHolder`, expects a `Jwt` principal, and returns `UUID.fromString(jwt.getSubject())` (throws `AUTH_TOKEN_MISSING`/401 otherwise). This single bean is injected into every controller and feeds `OwnedEntity.createdBy`, stamped server-side on every write. `OwnerProperties` (`mezo.auth.*`) feeds both `SecurityConfig` (the HS256 JWT secret) and `OwnerSeedData`. The frontend obtains the token via `lib/auth.ts#bootstrapOwnerToken` → `setToken` (`lib/api.ts`) → injected by `apiFetch`. The test framework's `ApiIntegrationTest.ownerAuthHeaders()`, `ResetDatabase`, and `UserPopulator` all depend on the demodata owner existing → ownership/auth is the seam every other seam rides on.

**Frontend hook layer ↔ data clients.** `frontend/src/data/hooks.ts` is the single FE↔data boundary; it re-exports `useTrain` from `trainHooks.ts` and `useRunning` from `runningHooks.ts` (so consumer import paths stay `@/data/hooks`). `isMockMode()` (`lib/mode.ts`) is the toggle. **Crossing contract:** the hook's *own* return shape (e.g. `WeightEntry`, `SleepEntry` from `frontend/src/data/types.ts`) — stable and hand-written, decoupled from the generated DTOs by the `*Api.ts` adapter layer.

**Error contract ↔ both sides.** The hand-written `techcore` `SystemMessage` (exception layer) and the generated `api.dto.SystemMessage` (wire contract from `common-schemas.yml`) are **two deliberately separate types kept field-compatible** by the contract ITs (`assertHasFieldError`/`assertHasRequestError` match on code/type/field, never resolved text). The FE has its own `SystemMessage` interface + `ApiError` in `lib/api.ts`. All three must agree on the field set — the contract IT is the guard.

**Train-internal seams (largest consumer).** `TrainController` fans one `TrainApi` out to seven services (`TrainService`, `WorkoutService`, `SportService`, `GymScheduleService`, `ExerciseCatalogService`, `ExerciseRecordService`, `RunningService`). `GymScheduleService` maintains the recurring weekly gym-time slots (`gym_schedule_slot`, `GET/PUT /api/train/gym-schedule`, full-replace) exactly like `SportService`'s sport-schedule methods. The `workout_session` table is reused for both **template days** (`templateSessionId == null`) and **workout instances** (`templateSessionId` set, `date`+`status` populated) — the discriminator column is the seam between the planning model (`TrainService`) and the execution model (`WorkoutService`). `ExerciseRecordService` aggregates over logged `exercise_set` rows; the exercise catalog (`exercise_catalog`, loaded by `ExerciseCatalogLoader`) is referenced *optionally* by `exercise.catalog_id` (unknown catalogId → 400 FIELD `VALIDATION_INVALID_VALUE`, never a raw FK 500). See the Train feature doc for the full fan-out.

---

## 6. How to use it (consume)

Two consumer surfaces.

**(a) Frontend — use an existing backed hook.** Import the hook from the single boundary, never the `*Api.ts` client directly:

```ts
import { useWeight } from '@/data/hooks'

function WeightPanel() {
  const { weightLog, logWeight } = useWeight()   // dual-mode: real or mock, transparently
  // weightLog: WeightEntry[]  (the hook's own shape, not the generated DTO)
  return <button onClick={() => logWeight({ date: today, weightKg: 82.4, note: null })}>Mentés</button>
}
```

The hook hides `isMockMode()` entirely; the component never sees `apiFetch` or a DTO. In real mode the mutation hits `POST /api/biometrics/weight` and invalidates the query; in mock mode it emulates the server via `setQueryData`.

**(b) Backend — call a feature from another feature.** Inject the *service* (not the controller), and resolve ownership from `CurrentUserId`:

```java
@Service
@RequiredArgsConstructor
class SomeService {
    private final WeightLogService weightLogService;
    private final CurrentUserId currentUserId;
    // ... weightLogService.list(currentUserId.get()) ...
}
```

Constructor injection only (Lombok `@RequiredArgsConstructor`), never field injection. The security principal is resolved via `currentUserId.get()` — it is **never** a contract/method parameter passed from the client.

---

## 7. How to extend it

The concrete recipe to add a new **backed feature or endpoint** (this is also the path to give Fuel/Insights/People a backend). Read the referenced `docs/references/*.md` *before* writing each layer — they are mandatory house standards.

1. **bd issue + `feat/<topic>` branch** (one issue/branch per change; merge `--no-ff` into main).
2. **Contract first** — add/extend `api/feature/<name>/<name>.yml`; **append it to `api/generate/merge.yml` `inputs:`**; run `cd api/generate && npm run generate:api`; commit `api/openapi.yml`. Follow `docs/references/api_contract_conventions.md` (schema/operationId/tag naming; spec-driven validation; `pattern` not `enum` on requests; `SystemMessageList` on every error; `security: []` for public endpoints). **Response codes are load-bearing** — with `useResponseEntity=false`+`interfaceOnly`, the controller returns the bare DTO and the 2xx status comes from the *first 2xx code* in the spec (201 vs 200 vs 204).
3. **Migration** — new Liquibase changeset named `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql` (mezo uses the **driving bd id**, not spec-kit `F{NNN}`), listed in `db/changelog/1.0.0/1.0.0_master.yml`. UUID PK, `created_by` FK→`app_user ON DELETE CASCADE`, soft-delete columns, explicit named constraints (`pk_/fk_/uq_/ck_/idx_`). Seed data is Java `@Profile("demodata")`, **never SQL**. Follow `docs/references/liquibase_conventions.md`.
4. **Entity** — `extends OwnedEntity`, UUID `@Id`, `@SQLDelete`+`@SQLRestriction`, mirror every DB constraint; jsonb → typed record via `@JdbcTypeCode(SqlTypes.JSON)`. Follow `docs/references/java_package_structure.md`.
5. **Repository** — `extends OwnedRepository<E>` if a date-ordered owned list suffices (gives `findAllOwned(createdBy)` for free — **requires an `e.date` field**; date-less aggregates need a bespoke finder, per the Javadoc). Else derived queries → JPQL → native (last resort). Follow `docs/references/spring_patterns.md`.
6. **Service** — `@Service @RequiredArgsConstructor`; **reads have no `@Transactional`, writes get method-level `@Transactional`**; stamp `createdBy` from `currentUserId.get()`; ownership gate returning **404** for missing *or* foreign rows (no existence leak); throw `SystemRuntimeErrorException` with a `messages.properties` code (add the code). Follow `spring_patterns.md` + `docs/references/error_handling.md`.
7. **Mapper** — MapStruct `@Mapper(componentModel="spring")`, entity→`api.dto`; `@Mapping` for renames (e.g. `weightKg`→`value`), `default` methods for type bridges (`Instant`→`OffsetDateTime`, enum `fromValue`). **Never hand-write a boundary DTO.**
8. **Controller** — `implements <Tag>Api`, inject the service + `CurrentUserId`, delegate. **No** `@RequestMapping`/`@PostMapping`/`@Valid`/`@ResponseStatus` on the impl — all of that comes from the generated interface.
9. **Config** — any tunable → `application.yml` under `mezo:` + a `@Validated *Properties` record (never `@Value`); feature toggles → a `FeaturesConfiguration` constant + `@ConditionalOnProperty` at the bean boundary. Follow `docs/references/configuration_conventions.md`.
10. **Tests (same change)** — add a `*ServiceIT` (`extends AbstractIntegrationTest`, `@Transactional`) and a `*ContractIT` (`extends ApiIntegrationTest`, HTTP round-trip through the generated interface); **add the new owned table to the `ResetDatabase` TRUNCATE list and add a `*Populator` for the new aggregate — in this same commit**. Assert via the verb helpers + `assertHas*Error`. Follow `docs/references/testing_standards.md` + `integration_test_framework.md`.
11. **Frontend** — `cd frontend && pnpm generate:api`; add a `lib/<name>Api.ts` client (request bodies `satisfies <Request>`, typed responses, explicit documented cast if the domain type is stricter); wire a **dual-mode** hook in / re-exported from `data/hooks.ts` (`isMockMode()` branch, `initialData` for mock, `invalidateQueries` for real). **Both test modes green + `pnpm build`.**
12. **Docs** — ADR in `docs/decisions/` for any direction change; update `docs/infrastructure/` for infra; per-feature spec/plan in `docs/superpowers/specs|plans/`; write the feature doc in `docs/features/`. Work isn't done until `docs/` reflects it.

To extend a **Train sub-feature** specifically, see the Train feature doc — the contract fragment is the single big `api/feature/train/train.yml`, and the new endpoint is wired onto the existing `TrainController` fan-out.

---

## 8. Testing

References: `docs/references/testing_standards.md` + `integration_test_framework.md`. Integration-first; AssertJ only; **no mocks / `@MockBean` / H2**; Java-based data via populators (no SQL test data); `test{Method}_should{Result}_when{Condition}` naming.

- `support/AbstractIntegrationTest.java` — `@SpringBootTest`, imports `TestcontainersConfiguration`, `DatabasePopulator`, `UserPopulator`, `TrainPopulator`, `ResetDatabase`; `@BeforeEach` runs `ResetDatabase.resetExceptMasterData()`. Service-level subclasses add their own `@Transactional` for rollback.
- `support/ApiIntegrationTest.java extends AbstractIntegrationTest` — `@ActiveProfiles("demodata")`, `RANDOM_PORT`, `TestRestTemplate`. **Not `@Transactional`** (server commits in its own tx; cleanup via `ResetDatabase`). Provides `ownerAuthHeaders()` (logs in via `/api/auth/login` with credentials from `OwnerProperties`, never hardcoded); verb helpers `getForBody/getForList/postForBody/putForBody/deleteAndExpect/exchangeForBody` where the **expected status is always a param and always asserted**; `exchangeForResponse` for header inspection (CORS); and `assertHasFieldError(body, field, code)` / `assertHasRequestError(body, code)` that parse the `List<SystemMessage>` JSON and match on **code/type/field, never resolved text** (codes are the contract). (SB4 → Jackson 3, `tools.jackson.databind.ObjectMapper`.)
- `support/ResetDatabase.java` — one `TRUNCATE ... CASCADE` over all owned domain tables (now incl. `goal_plan_link` + the three progression tables `skill_progress`, `level_up_event`, `perk_unlock`) + `DELETE` of non-owner users/profiles. **Growth rule (mandatory): every new owned table is added here in the same change; `exercise_catalog` is master data and must NOT be truncated.**
- `support/populator/{UserPopulator,TrainPopulator,RunningPopulator,…,SkillProgressPopulator,LevelUpEventPopulator}.java` — one `<Aggregate>Populator` per aggregate; `DatabasePopulator` is the facade. **Growth rule: each new aggregate gets its own populator in the same change.** (`mezo-8e4` adds `SkillProgressPopulator` + `LevelUpEventPopulator`.)
- DB target: fixed `mezo_test` compose DB by default; throwaway Testcontainers via `-Dmezo.test.use-testcontainers=true`. Surefire also runs `*IT.java` (Failsafe deliberately unconfigured to avoid double execution).
- Canonical examples: `feature/biometrics/BiometricsContractIT.java` (round-trips weight POST/GET, asserts a 400 FIELD error, asserts check-in upsert); `feature/train/ProvenanceRoundTripIT.java` (proves the typed-jsonb envelope survives a DB round-trip).

**Commands:**

```bash
# Backend (compose Postgres up first)
cd backend && docker compose up -d
./mvnw clean test                                   # ITs vs fixed mezo_test DB — ALWAYS use clean (Lombok+MapStruct incremental is flaky)
./mvnw clean test -Dmezo.test.use-testcontainers=true   # throwaway PG (CI / no compose)

# Frontend — BOTH modes must be green
cd frontend
pnpm test                          # REAL mode (default)
VITE_USE_MOCK=true pnpm test       # MOCK mode
pnpm build                         # tsc -b && vite build

# Contract regen
cd api/generate && npm run generate:api    # merge fragments -> api/openapi.yml
cd frontend && pnpm generate:api           # regenerate src/lib/api.gen.ts
# backend Java DTOs/interfaces regenerate automatically in mvn generate-sources
```

---

## 9. Decisions, gotchas & deferred

- **Contract-first is the rule, not a guideline.** Never hand-write boundary DTOs; never re-add validation the spec can express. Both generated artifacts (`api/openapi.yml`, `frontend/src/lib/api.gen.ts`) are committed and regenerated together in one green commit; breaking changes are allowed *within* Phase 2 since FE+BE ship together. Spec → `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`; convention → `docs/references/api_contract_conventions.md`.
- **`enum` vs `pattern` on request fields** — invalid enum → 500 (Jackson), invalid pattern → 400 (bean validation). Use `pattern` for request enums (live in `SportScheduleSlotInput`).
- **`@NotBlank` gotcha** — no OpenAPI equivalent; use `required` + `minLength: 1`. An empty string then yields `VALIDATION_INVALID_VALUE` (Size), not `VALIDATION_REQUIRED_FIELD` (null/missing only).
- **Cross-field validation lives in the service, not the spec** — a `targetDate >= startDate` rule can't be expressed in OpenAPI (no cross-field constraint), so `GoalService.applyUpsert` guards it in code: inverted window → 400 FIELD `VALIDATION_INVALID_VALUE` on `targetDate` (G4b, `mezo-b0k`). It pre-empts a 500 in `GoalTimelineService` (a negative window length); §4d. Same principle for any other inter-field invariant — guard at the write boundary, throw a FIELD `SystemMessage`.
- **Two `SystemMessage`s** (hand-written `techcore` vs generated `api.dto`) are kept field-compatible by contract ITs — **do not unify them.**
- **`OwnedRepository.findAllOwned` requires an `e.date` field** — date-less aggregates need bespoke finders. The `deleted = false` JPQL clause is intentionally redundant with `@SQLRestriction` — keep both, the comment says so explicitly.
- **Soft delete + ownership gate** → "not found" and "not yours" are intentionally indistinguishable (both 404) — no existence leak.
- **Always `./mvnw clean`** (Lombok + MapStruct incremental compile is flaky).
- **`useResponseEntity=false` + `interfaceOnly` + `skipDefaultInterface`** → the spec's response codes are load-bearing (the first 2xx code becomes the HTTP status).
- **HS256 must be set explicitly** in `AuthService` (NimbusJwtEncoder can't infer the alg from a symmetric secret).
- **No login UI in Phase 2** — single owner, token bootstrapped from env (`VITE_OWNER_EMAIL`/`VITE_OWNER_PASSWORD`).
- **Deferred / not yet adopted:** Fuel/Insights/People backends + their contract fragments are unbuilt (🔶 mock-only). WireMock (first external API), mail/Firebase/RabbitMQ mocks, and a multi-user role matrix are all deferred. **Phase 3** (🟣 Spring AI, pgvector, RAG) is entirely deferred — `ProvenanceEnvelope`'s "Fuel reuses this for meal score" note and the pgvector section of `liquibase_conventions.md` are forward-looking only.

---

## 10. Key files

**Contract pipeline**
- `api/base.yml` — info/servers/global bearer security; merge base
- `api/common/common-schemas.yml` — `SystemMessage` + `SystemMessageList`
- `api/generate/merge.yml` — ordered fragment input list (append new fragments here)
- `api/generate/package.json` — `openapi-merge-cli`, `generate:api`
- `api/openapi.yml` — committed merged contract (source of truth)
- `api/feature/{auth,weight,sleep,checkin,train,goal,biometrics-profile,pantry}/*.yml` — per-feature fragments

**Backend generator config**
- `backend/pom.xml` (~175-215) — `openapi-generator-maven-plugin` (spring), configOptions, Lombok DTO annotations

**techcore (the reusable spine)**
- `techcore/persistence/OwnedEntity.java`, `OwnedRepository.java` — owned-entity superclass + `findAllOwned`
- `techcore/security/SecurityConfig.java`, `CurrentUserId.java`, `CorsProperties.java` — stateless JWT + ownership resolution + CORS
- `techcore/exception/GlobalExceptionHandler.java`, `SystemMessage.java`, `SystemRuntimeErrorException.java`, `Level.java`, `Type.java` — error contract
- `backend/src/main/resources/messages.properties` — message codes; `application.yml` — `mezo:` config + `ddl-auto: validate`

**Reference feature (weight — smallest full slice)**
- `feature/biometrics/weight/controller/WeightLogController.java`, `service/WeightLogService.java`, `mapper/WeightLogMapper.java`, `repository/WeightLogRepository.java`, `entity/WeightLogEntity.java`

**Goal + biometric profile (G1, `mezo-2hp` — date-less owned aggregates)**
- `feature/goal/{controller/GoalController,service/GoalService,mapper/GoalMapper,repository/GoalRepository,entity/GoalEntity}.java` + `feature/goal/GoalSeedData.java` (demodata active goal + G3 plan links)
- **G3 plan-link aggregate (`mezo-3sc`):** `feature/goal/entity/GoalPlanLinkEntity.java`, `repository/GoalPlanLinkRepository.java`, `service/{GoalPlanLinkService,GoalTimelineService}.java`, `mapper/GoalPlanLinkMapper.java`; cascade in `service/GoalService.java#deleteGoal`; read-only train finder `feature/train/repository/MesocycleRepository.java#findByIdAndCreatedByAndDeletedFalse`
- `feature/biometrics/profile/{controller/BiometricProfileController,service/BiometricProfileService,mapper/BiometricProfileMapper,repository/BiometricProfileRepository,entity/BiometricProfileEntity}.java`

**Fuel — Pantry (Kamra) (slice C, `mezo-9xu` — single `pantry_item` table, kind-projected)**
- `feature/pantry/{controller/PantryController,service/PantryService,mapper/PantryMapper,repository/PantryItemRepository,entity/PantryItemEntity}.java` + typed-jsonb micros `entity/MicroFact.java`. `PantryService.getPantry` projects by `kind` into `{ ingredients, stash }`; `validatePerKind` holds the per-kind required-field rules (no DB CHECKs). No demodata seed (clean slate).
- contract fragment `api/feature/pantry/pantry.yml` (tag `Pantry` → `PantryApi`; schemas `PantryResponse`/`PantryItemRequest`/`PantryItemResponse`/`IngredientResponse`/`SupplementStashResponse`/`PantryMacros`/`PantryMicro`/`PantryStock`)

**Progression (P1 foundation + P2 gym engine + P3a run engine + P3b sport engine + P4 profile API, `mezo-8e4` — `levelUp` on the Train contract + the profile fragment; see §4e)**
- `feature/progression/{ProgressionCurve,PerkCatalog,ProgressionGate,ProgressionTaxonomy}.java` + `config/ProgressionProperties.java` (`mezo.progression.{curve,gym,run,sport,robustness,radar}`); content `src/main/resources/content/progression-perks.json`
- entities `feature/progression/entity/{SkillProgressEntity,LevelUpEventEntity,PerkUnlockEntity}.java` + typed-jsonb payload `entity/LevelUpResult.java`; repos `repository/{SkillProgressRepository,LevelUpEventRepository,PerkUnlockRepository}.java`
- engine `feature/progression/service/{ProgressionService,RobustnessCalculator}.java` (`applyGym`/`applyRun`/`applySport` over the shared private `award(...)` tail; `getProfile` read aggregation); gym signal `gym/{GymSignal,GymSignalCalculator}.java`; run signal `run/{RunSignal,RunSignalCalculator}.java`; sport signal `sport/{SportSignal,SportSignalCalculator}.java`; DTO map `mapper/LevelUpResultMapper.java`
- triggers (switch-gated) on the Train side: `WorkoutService.finishWorkout` (gym → `WorkoutInstanceResponse.levelUp`) + `RunningService.logSession` (run → `RunSessionLogResponse.levelUp`) + `SportService.logSportSession` (sport → `SportSessionResponse.levelUp`)
- read surface (P4): `controller/ProgressionController.java` (`@ConditionalOnProperty`-gated `implements ProgressionApi`) + the first `api/feature/progression/progression.yml` fragment (`GET /api/progression/profile`); **FE wiring (cards + dual-mode mock) is P6**

**Auth**
- `feature/auth/...` (`AuthController`, `AuthService`, `OwnerProperties`, `OwnerSeedData`, `entity/AppUserEntity`, `UserProfileEntity`)

**Train (largest consumer — one `TrainApi` → six services)**
- `feature/train/controller/TrainController.java`; services `TrainService/WorkoutService/SportService/GymScheduleService/ExerciseCatalogService/ExerciseRecordService/RunningService`; mappers `TrainMapper/RunningMapper`
- typed-jsonb: `entity/ProvenanceEnvelope.java`, `VolumeRecomputeJson.java`, `RunningBlockStructure.java`; discriminator: `entity/WorkoutSessionEntity.java`
- content/seed: `ExerciseCatalogLoader.java` (master content, all profiles), `TrainSeedData.java`, `RunningSeedData.java` (demodata)

**Liquibase**
- `db/changelog/db.changelog-master.yaml`, `1.0.0/1.0.0_master.yml`, `1.0.0/script/*.sql` (bd-ids: v67/n5q/tod/0ae/7ot/b4n/auk + `202606181200_mezo-2hp_create_goal.sql` for `goal` + `biometric_profile` + `202606181600_mezo-3sc_create_goal_plan_link.sql` for `goal_plan_link` + `202606221200_mezo-9xu_create_pantry_item.sql` for `pantry_item` + `202606251200_mezo-8e4_create_progression.sql` for `skill_progress` + `level_up_event` + `perk_unlock`)

**Test framework**
- `support/AbstractIntegrationTest.java` (imports the populators, incl. `PantryItemPopulator`, `SkillProgressPopulator`, `LevelUpEventPopulator`), `ApiIntegrationTest.java`, `ResetDatabase.java` (TRUNCATE list now incl. `goal, biometric_profile, pantry_item, skill_progress, level_up_event, perk_unlock`), `DatabasePopulator.java`, `populator/{UserPopulator,TrainPopulator,RunningPopulator,GoalPopulator,BiometricProfilePopulator,PantryItemPopulator,SkillProgressPopulator,LevelUpEventPopulator}.java`
- canonical ITs: `feature/biometrics/BiometricsContractIT.java`, `feature/train/ProvenanceRoundTripIT.java`; G1: `feature/goal/{GoalServiceIT,GoalContractIT}.java`, `feature/biometrics/profile/{BiometricProfileServiceIT,BiometricProfileContractIT}.java`; G3: `feature/goal/{GoalPlanLinkServiceIT,GoalTimelineServiceIT,GoalTimelineContractIT}.java`; Pantry (`mezo-9xu`): `feature/pantry/{PantryItemRepositoryIT,PantryServiceIT,PantryApiIT}.java`; Progression P1+P2+P3a+P3b (`mezo-8e4`): `feature/progression/{ProgressionCurveTest,PerkCatalogIT,ProgressionPersistenceIT,ProgressionPopulatorIT,ProgressionPropertiesIT}.java` + engine `service/{ProgressionServiceIT,ProgressionRunIT,ProgressionSportIT,ProgressionProfileServiceIT}.java` + signal `run/RunSignalCalculatorIT.java` + `sport/SportSignalCalculatorIT.java` + read surface `controller/{ProgressionProfileApiIT,ProgressionProfileSwitchOffApiIT}.java` + Train-side triggers `feature/train/{WorkoutFinishLevelUpApiIT,RunSessionLevelUpApiIT}.java`

**Frontend seam**
- `frontend/src/lib/api.ts` (`apiFetch`, `ApiError`, `setToken`, `API_BASE`), `lib/mode.ts` (`isMockMode`), `lib/auth.ts` (`bootstrapOwnerToken`), `lib/api.gen.ts` (generated), `lib/biometricsApi.ts`, `lib/trainApi.ts`, `lib/runningApi.ts`, `lib/goalApi.ts`, `lib/goalLinkApi.ts` (G3 timeline/attach/detach), `lib/biometricProfileApi.ts`, `lib/pantryApi.ts` (slice C — `/api/pantry` CRUD)
- `frontend/src/data/hooks.ts` (single FE↔data boundary), `data/trainHooks.ts`, `data/runningHooks.ts`, `data/weightHooks.ts`, `data/goalHooks.ts` (dual-mode; G3 `useGoal` populates real linked plans from the timeline; G4a adds `useGoalCreation` — the first goal write; G4b adds `useGoalActions` — archive/delete/attach/detach — and widens `useGoal` with raw `goalResponse`/`timeline`/`goalId`; **G6 adds `useFeasibilityPreview`** — debounced live preview, and drops the profile-upsert step from `useGoalCreation`), `data/biometricHooks.ts` (**G6 — `useBiometricProfile` 404→null + `useBiometricActions` upsert→invalidate `['biometricProfile']`+`['goals']`**), `data/pantryHooks.ts` (**slice C `mezo-9xu` — `usePantry` dual-mode read kind-split + `usePantryActions` add/update/delete; re-exported from `hooks.ts`**) consuming `lib/pantryApi.ts`
- mock-only (no backend yet): `frontend/src/data/fuel.ts`, `pantry.ts` (the static Pantry/recipe seed — the backed inventory CRUD flows through `lib/pantryApi.ts`, not this file), `fuelWeek.ts`, `insights.ts`, `people.ts`

**House-standard references (linked, not restated)**
- `docs/references/api_contract_conventions.md`, `java_package_structure.md`, `spring_patterns.md`, `error_handling.md`, `liquibase_conventions.md`, `testing_standards.md`, `integration_test_framework.md`, `configuration_conventions.md`

**Cross-link to existing docs**
- Phase-2 design: `docs/superpowers/specs/2026-06-10-phase2-backend-design.md`; Train write/clean-slate: `2026-06-11-train-write-clean-slate-design.md`; running slice: `2026-06-14-train-running-slice-design.md`; goal-system G1: `2026-06-18-goal-system-design.md`; plans under `docs/superpowers/plans/`
- ADR: `docs/decisions/0001-deploy-on-k3s-argocd-learning-track.md`; roadmap: `docs/milestones/roadmap.md`; infra: `docs/infrastructure/`
