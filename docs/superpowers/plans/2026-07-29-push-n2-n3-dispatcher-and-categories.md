# Push N2 + N3 — Dispatcher, 11 Categories, and the Settings Screen · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the notification settings screen from the approved mockup, working — all 11 categories individually toggleable with adjustable lead times, a live volume-preview header, and a dispatcher that actually sends them at Daniel's own daily anchors.

**Architecture:** one per-minute `@Scheduled` job computes today's due items from three sources (backend-native anchors, proactive-content readiness, and an FE-written recurring schedule snapshot), filters them through per-category preferences, dedupes against a `push_log`, and hands the outbound HTTP to the async executor. The due computation is a **pure function** so it is table-testable without Spring. N1's delivery layer (`techcore/webpush` + `PushSender`) is consumed unchanged.

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · Postgres 16 + Liquibase · React 19 + Vite + TanStack Query

**Spec of record:** [`docs/superpowers/specs/2026-07-29-push-notifications-design.md`](../specs/2026-07-29-push-notifications-design.md) — §1 scope, §3 architecture, §5 data model, **§6 the category catalog + copy rules + the corrected anchor facts**, §7 frontend, §9 switches, §13 risks. **Approved mockup (the UI target):** [`2026-07-29-push-notifications-mockup.html`](../specs/2026-07-29-push-notifications-mockup.html) — direction **C**.

**Predecessor:** N1 shipped in PR #101 and is **proven end to end** — a real push reached the iPhone on 2026-07-29. Its code is the pattern library for this plan; where a step says "mirror X", read X in the repo.

**bd:** `mezo-h4wp.6.2` (N2, tasks 1-8) and `mezo-h4wp.6.3` (N3, tasks 9-12). Claim `mezo-h4wp.6.2` before Task 1. **One branch for both** (`feat/push-notifications-n2-n3`): the settings screen spans the two issues and splitting it would mean shipping a half-built screen. Each commit carries the bd id of the task it belongs to.

## ⚠️ PLAN CORRECTION (2026-07-29, discovered executing Task 2) — read before Task 3

Two defects in this plan's original shape, found the moment Task 1's contract landed:

**1. There is ONE generated interface, so there is ONE controller.** `openapi-generator` emits one interface per **tag**, and all six operations carry the tag `Notification` — so `NotificationApi` declares all six (`getNotificationPrefs`, `putNotificationPrefs`, `putNotificationSchedule`, `registerPushSubscription`, `sendTestPush`, `unregisterPushSubscription`). A Java class implementing an interface must implement all of it, so the File Structure's `NotificationPrefController` **and** `NotificationScheduleController` cannot exist as written. **Correction: extend the existing `feature/notification/controller/NotificationController` with the three new methods**, delegating to the new services — the thin-delegation shape `RitualController` already uses. Ignore those two rows in the File Structure table.

**2. The task order left the branch non-compiling.** Task 1 added three interface methods with no implementation, so `backend` does not compile until they exist — every later backend task hits it, and CI would fail. Task 2's implementer worked around it with a temporary local stub (reverted before committing, commit verified clean), which is the right call once but must not become the norm.

**Corrected execution order** (task *texts* keep their original numbers; only the sequence changes):

| Order | Task | Why here |
|---|---|---|
| 1 ✅ | 1 — contract | done |
| 2 ✅ | 2 — `notification_pref` + `push_log` | done |
| 3 | **3** — category catalog | pure enum, no dependencies |
| 4 | **9 (step 1 only)** — the `notification_schedule` migration + entity + repository | the schedule service needs its table before compilation can be restored |
| 5 | **6 + 9 (rest)** — pref service, schedule service, and **all three controller methods together** | this is the step that **restores compilation**; do it as one task, not two |
| 6 | **4** — `DueEvaluator` | |
| 7 | **5** — `AnchorResolver` | |
| 8 | **7** — `NotificationDispatchJob` | |
| 9-13 | **8, 10, 11, 12, 13** | frontend, docs, ship — unchanged |

**Until order-step 5 lands, `./mvnw` will not compile the main sources.** A task before it that needs a green test run may stub the three controller methods locally, but must revert the stub before staging and prove the commit is clean with `git show --name-only HEAD`.

## Global Constraints

- **Zero new Maven dependencies.**
- Base package `io.mrkuhne.mezo`; layout `feature/{name}/{controller,service,repository,entity,dto,mapper,config}` + `techcore/`.
- Constructor injection via `@RequiredArgsConstructor`, **never** field injection. `@Transactional` on **methods only**.
- **No `@Value`** — tunables only via `@Validated` `@ConfigurationProperties` records under the `mezo:` root. Extend the existing `feature/notification/config/NotificationProperties`; do **not** add a second record.
- **UUID PKs** (`gen_random_uuid()`), `created_by uuid` set server-side from the principal, `is_deleted` + `@SQLRestriction`/`@SQLDelete`. **Soft delete only.**
- Liquibase: one script per change, `{YYYYMMDDHHMM}_{driving-bd-id}_{snake_desc}.sql`, explicit constraint names (`pk_`/`fk_`/`uq_`/`ck_`/`idx_`). Never modify a released changeset. Register in `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (**YAML**, following the newest neighbour's idiom). Seed data in Java `@Profile("demodata")`, never SQL.
- **Every new owned table joins the `ResetDatabase` TRUNCATE list in the same change**, and gets a `*Populator` (`@TestComponent` in `support/populator/`, registered in `AbstractIntegrationTest`'s `@Import` list — **not** via `DatabasePopulator`, which is only a `UserPopulator` facade).
- `AbstractIntegrationTest` has **no `ownerId()` helper** — use the per-IT private helper pattern at `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedDataIT.java:33-35`.
- **Contract-first:** edit `api/feature/notification/notification.yml` BEFORE any Java/TS, merge (`cd api/generate && npm run generate:api`), regenerate FE types (`cd frontend && pnpm generate:api`). Never hand-write a boundary DTO. `satisfies` on FE request bodies.
- **Errors:** `SystemRuntimeErrorException` + a code in `backend/src/main/resources/messages.properties` (plural filename). Existing: `WEBPUSH_KEY_INVALID` (400, client material only), `WEBPUSH_SIGN_FAILED`/`WEBPUSH_ENCRYPT_FAILED` (500).
- **Never log a full push endpoint** (capability URL) or key material. `WebPushClient` already scrubs URLs from exception messages — do not reintroduce a leak.
- Tests: integration-first, `ApiIntegrationTest` (HTTP) / `AbstractIntegrationTest` (service), **AssertJ only**, `test{Method}_should{Result}_when{Condition}`, **no `@MockBean`, no H2**. Pure logic gets plain unit tests with no Spring context.
- **Frontend:** four layers; features import from **`@/data/hooks` only**; deep absolute `@/*` imports, no relative `../`; colocated tests; `shared/ui` stays domain-free. **Read `docs/references/frontend_conventions.md` before touching `frontend/src`.**
- **Test commands — use exactly these; do NOT run the full backend suite** (this 16 GB machine OOMs on it; CI is the authoritative full-suite gate):
  - backend: `cd backend && ./mvnw clean test -Dtest='<YourClasses>,ArchitectureTest'` — **always with `clean`** (Lombok+MapStruct incremental compile is flaky).
  - frontend: `cd frontend && pnpm test <pattern> && VITE_USE_MOCK=true pnpm test <pattern>`; the **whole** FE suite + `pnpm build` only when a shared file (`data/hooks.ts`, `shared/ui/*`) is touched.
  - Local Postgres is already up on port **15432**.
  - Never run `pnpm test:visual` or regenerate a Playwright golden — baselines are per-platform and CI gates the linux ones.
- **Commit:** conventional subject carrying the task's bd id. Stage **explicit paths** + `git commit --no-verify` (a beads hook force-stages a stray gitignored root `issues.jsonl`; never `git add -A`). Nothing under `frontend/dist/`. After each commit run `git show --name-only HEAD`.
- **Do NOT write to the SDD ledger** (`.superpowers/sdd/<plan>/progress.md`) — it is the coordinator's alone.

## Anchor facts established by exploration (use these; do not re-derive)

These were verified against the code on 2026-07-29. Getting any of them wrong produces a notification at the wrong minute or a per-minute write storm.

| Anchor | The read to use | Trap |
|---|---|---|
| Gym slots | `GymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID)` → entities with `Integer getDayOfWeek()` + `String getTime()` (`HH:mm`) | **`dayOfWeek` is 0=Mon..6=Sun**, while `java.time.DayOfWeek.getValue()` is 1=Mon..7=Sun. Convert explicitly. |
| Sport slots | `SportScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID)` — same shape, plus `getSport()`, `getKind()` | same 0-based weekday |
| Today's session title | `WorkoutService.findPlannedTemplateForDate(UUID createdBy, LocalDate date)` → `Optional<WorkoutSessionEntity>`; `getDayLabel()`, `getType()`, `getDurationEst()` | **NEVER call `WorkoutService.getToday(...)`** — it hardcodes `LocalDate.now()` and triggers `@Transactional` **writes** (`autoCloseStale`, `rolloverIfDue`, `ensureClosingExercises`). A per-minute cron would fire those every minute per user. |
| Wake / bed | `SleepAnchorPort.resolve(UUID)` → `SleepAnchor(LocalTime wake, LocalTime bed)` | **Never returns empty** (falls back to `SleepGoalProperties`). Do **not** read `goal.wake_time`/`goal.bed_time` — retired columns. |
| Ritual window | `RitualService.getDay(UUID, LocalDate)` → `RitualDayResponse.getWindow()` → `getOpensAt()`/`getPrepStartsAt()`/`getBedTime()` | The **whole bean is absent** when `mezo.feature.ritual.enabled=false`. Inject via `ObjectProvider<RitualService>` and yield no due item when unavailable. |
| Medication cycle | `MedicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(UUID)` + `MedicationCycleService.derive(UUID, MedicationEntity, LocalDate)` → `MedicationCycle(int retaDay, String phaseKey, String phaseLabel, Instant lastDoseAt, List<Cell> week)` | `retaDay == 0` is the honest "no dose logged yet" state — **not** a dose day. |
| Briefing | `BriefingRepository.findByCreatedByAndBriefingDate(UUID, LocalDate)`; `getContent()` → `BriefingContentEnvelope(String eyebrow, List<String> body, List<Ref> refs)` | prose is `body` (a list) — join it before excerpting |
| Heartbeat | `HeartbeatNoteRepository.findByCreatedByAndNoteDateAndWindowKey(UUID, LocalDate, String)`; `getContent()` → `String`. Constants `WINDOW_MIDDAY="midday"`, `WINDOW_EVENING="evening"` | |
| Weekly | `WeeklySuggestionRepository.findByCreatedByAndWeekStart(UUID, LocalDate)`; `getProse()` → `String` | `weekStart` is the ISO Monday |
| Memoir | `MemoirRepository.findByCreatedByAndWeekStart(UUID, LocalDate)`; `getTitle()`, `getBody()` | |
| Users | `AppUserRepository.findAll()` (inherited), `AppUserEntity.getId()` | the `ChallengeJob`/`HeartbeatJob` idiom: per-user try/catch, never abort the loop |
| Check-in + fuel slot times | **Backend has none** — check-in times exist only in `frontend/src/data/today/checkins.ts`, fuel slot math only in `frontend/src/features/fuel/logic/buildProtocol.ts` | this is exactly why N3's FE-written snapshot exists |

**The scheduler pool is size 1.** `SchedulingConfiguration` defines no `TaskScheduler` and `application.yml` sets no `spring.task.scheduling.pool.size`, so all 18 existing `@Scheduled` methods share **one thread**. The dispatcher therefore does DB-only computation on the scheduler thread and hands sending to the async executor (`techcore/configuration/AsyncConfiguration`). **Leave the pool at 1** — the existing jobs have always run serialized and may depend on it.

## File Structure

**Backend — new**

| File | Responsibility |
|---|---|
| `feature/notification/entity/NotificationPrefEntity.java` | per-category enabled + lead |
| `feature/notification/entity/PushLogEntity.java` | per-day dedup ledger |
| `feature/notification/entity/NotificationScheduleEntity.java` | the FE-written recurring snapshot (N3) |
| `feature/notification/repository/{NotificationPref,PushLog,NotificationSchedule}Repository.java` | owner-scoped finders |
| `feature/notification/domain/NotificationCategory.java` | the 11-value catalog enum + its defaults |
| `feature/notification/domain/DueItem.java` | `record (NotificationCategory category, int minuteOfDay, String dedupKey, String title, String body, String url)` |
| `feature/notification/domain/CategoryPref.java` | `record (NotificationCategory category, boolean enabled, int leadMinutes)` |
| `feature/notification/domain/AnchorSet.java` | the pure evaluator's input: resolved anchors + prose availability + schedule rows |
| `feature/notification/service/DueEvaluator.java` | **pure**: `(now, prefs, anchors) → List<DueItem>` |
| `feature/notification/service/AnchorResolver.java` | the impure half: reads every anchor into an `AnchorSet` |
| `feature/notification/service/NotificationDispatchJob.java` | the per-minute cron + async send handoff |
| `feature/notification/service/NotificationPrefService.java` | pref read/write with lazy code defaults |
| `feature/notification/service/NotificationScheduleService.java` | per-category snapshot replace (N3) |
| `feature/notification/controller/NotificationPrefController.java` | `GET`/`PUT /api/notification/pref` |
| `feature/notification/controller/NotificationScheduleController.java` | `PUT /api/notification/schedule` (N3) |

**Backend — modified:** `feature/notification/config/NotificationProperties.java` · `application.yml` · `support/ResetDatabase.java` · `support/AbstractIntegrationTest.java` (`@Import`) · `support/populator/NotificationPopulator.java`

**API contract — modified:** `api/feature/notification/notification.yml` (+ regenerated `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`)

**Frontend — new:** `src/data/notification/notificationPrefHooks.ts` · `src/data/notification/notificationScheduleWriter.ts` · `src/features/me/components/NotificationCategoryRow.tsx` · `src/features/me/components/NotificationPreviewHeader.tsx` · `src/features/me/logic/notificationForecast.ts` (+ colocated tests)
**Frontend — modified:** `src/data/notification/notificationApi.ts` · `src/data/hooks.ts` · `src/data/types.ts` · `src/features/me/pages/NotificationsPage.tsx` · `src/app/AppLayout.tsx` (or wherever an app-open effect belongs — check before choosing)

---

### Task 1: Contract — pref + schedule endpoints

**Files:** Modify `api/feature/notification/notification.yml`; commit regenerated `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts`.

**Interfaces produced:** generated `NotificationApi` gains `NotificationPrefListResponse getNotificationPrefs()`, `void putNotificationPrefs(NotificationPrefListRequest)`, `void putNotificationSchedule(NotificationScheduleRequest)`; DTOs `NotificationPref{category,enabled,leadMinutes}`, `NotificationScheduleEntry{weekday?,time,category,title,body?,deeplink,source}`.

- [ ] **Step 1: Add the three operations and their schemas.** Mirror the existing fragment's style exactly (tags `[Notification]`, `SystemMessageList` **referenced** not redefined, `required` + `minLength: 1` on every required string — the house rule at `docs/references/api_contract_conventions.md:42`).

```yaml
  /api/notification/pref:
    get:
      tags: [Notification]
      operationId: getNotificationPrefs
      summary: Per-category notification preferences, code defaults filled in (Notification)
      responses:
        '200':
          description: All 11 categories, always complete — a category with no stored row reports its code default
          content:
            application/json:
              schema: { $ref: '#/components/schemas/NotificationPrefListResponse' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
    put:
      tags: [Notification]
      operationId: putNotificationPrefs
      summary: Upsert one or more category preferences (Notification)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NotificationPrefListRequest' }
      responses:
        '204': { description: Stored }
        '400':
          description: VALIDATION_ERROR or NOTIFICATION_UNKNOWN_CATEGORY
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
  /api/notification/schedule:
    put:
      tags: [Notification]
      operationId: putNotificationSchedule
      summary: Replace the FE-owned recurring schedule for the given categories (Notification)
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: '#/components/schemas/NotificationScheduleRequest' }
      responses:
        '204': { description: Replaced }
        '400':
          description: VALIDATION_ERROR or NOTIFICATION_UNKNOWN_CATEGORY
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
        '401':
          description: Missing/invalid token
          content:
            application/json:
              schema: { $ref: '#/components/schemas/SystemMessageList' }
```

Schemas (`components.schemas`):

```yaml
    NotificationPref:
      type: object
      required: [category, enabled, leadMinutes]
      properties:
        category: { type: string, minLength: 1, maxLength: 24, example: gym }
        enabled: { type: boolean }
        leadMinutes: { type: integer, minimum: 0, maximum: 240 }
    NotificationPrefListResponse:
      type: object
      required: [prefs]
      properties:
        prefs:
          type: array
          items: { $ref: '#/components/schemas/NotificationPref' }
    NotificationPrefListRequest:
      type: object
      required: [prefs]
      properties:
        prefs:
          type: array
          minItems: 1
          items: { $ref: '#/components/schemas/NotificationPref' }
    NotificationScheduleEntry:
      type: object
      required: [time, category, title, deeplink, source]
      properties:
        weekday: { type: integer, minimum: 1, maximum: 7, nullable: true, description: "ISO 1=Mon..7=Sun; null = every day" }
        time: { type: string, minLength: 5, maxLength: 5, example: "14:00" }
        category: { type: string, minLength: 1, maxLength: 24 }
        title: { type: string, minLength: 1, maxLength: 120 }
        body: { type: string, maxLength: 300, nullable: true }
        deeplink: { type: string, minLength: 1, maxLength: 200 }
        source: { type: string, minLength: 1, maxLength: 24, example: buildProtocol }
    NotificationScheduleRequest:
      type: object
      required: [categories, entries]
      properties:
        categories:
          type: array
          minItems: 1
          description: "The categories this payload REPLACES — a category listed with no entries is cleared"
          items: { type: string, minLength: 1, maxLength: 24 }
        entries:
          type: array
          items: { $ref: '#/components/schemas/NotificationScheduleEntry' }
```

**Note the deliberate asymmetry:** `weekday` on the wire is **ISO 1-7** (what `java.time.DayOfWeek.getValue()` and JS can both express unambiguously), while `gym_schedule_slot.dayOfWeek` is the legacy **0-6**. The conversion happens once, in `AnchorResolver` (Task 5). Do not "harmonise" them.

- [ ] **Step 2: Merge and regenerate.** `cd api/generate && npm run generate:api` then `cd ../../frontend && pnpm generate:api`.
- [ ] **Step 3: Verify the backend interface.** `cd backend && ./mvnw clean generate-sources -q` then confirm the three new methods exist: `grep -n "getNotificationPrefs\|putNotificationPrefs\|putNotificationSchedule" target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/controller/NotificationApi.java`. **Record the exact signatures in your report** — Tasks 6 and 9 implement them.
- [ ] **Step 4: Commit.**

```bash
git add api/feature/notification/notification.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git commit --no-verify -m "feat(api): notification pref + schedule contract (mezo-h4wp.6.2)"
```

---

### Task 2: `notification_pref` + `push_log` tables

**Files:** Create `backend/src/main/resources/db/changelog/1.0.0/script/202607291400_mezo-h4wp.6.2_create_notification_pref_and_push_log.sql`; register in `1.0.0_master.yml`; create the two entities + repositories; extend `ResetDatabase`; extend `NotificationPopulator`; test `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationPrefRepositoryIT.java`.

**Interfaces produced:** `NotificationPrefEntity` (`category`, `enabled`, `leadMinutes`), `PushLogEntity` (`logDate`, `dedupKey`, `category`, `sentAt`); `NotificationPrefRepository.findByCreatedBy(UUID)` + `findByCreatedByAndCategory(UUID, String)`; `PushLogRepository.findByCreatedByAndLogDate(UUID, LocalDate)` + `existsByCreatedByAndLogDateAndDedupKey(UUID, LocalDate, String)`.

- [ ] **Step 1: Write the migration.**

```sql
-- Per-category notification preferences + the per-day send ledger (bd mezo-h4wp.6.2).
-- A MISSING pref row means "the code default" (NotificationCategory), so a newly added
-- category ships with its intended default instead of silently arriving as OFF, and a
-- fresh install needs no seed data.
create table notification_pref (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    category     varchar(24) not null,
    enabled      boolean     not null,
    lead_minutes integer     not null default 0,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    constraint pk_notification_pref primary key (id),
    constraint fk_notification_pref_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_notification_pref_lead_minutes check (lead_minutes between 0 and 240)
);

create unique index uq_notification_pref_created_by_category
    on notification_pref (created_by, category) where is_deleted = false;

-- The dedup ledger: one row per (user, local day, dedupKey). Written BEFORE the send, so a
-- failed send never re-fires the same notification on the next minute — a lost notification
-- is strictly better than a duplicated one.
create table push_log (
    id         uuid        not null default gen_random_uuid(),
    created_by uuid        not null,
    log_date   date        not null,
    dedup_key  varchar(80) not null,
    category   varchar(24) not null,
    sent_at    timestamptz not null default now(),
    is_deleted boolean     not null default false,
    created_at timestamptz not null default now(),
    constraint pk_push_log primary key (id),
    constraint fk_push_log_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_push_log_created_by_log_date_dedup_key
    on push_log (created_by, log_date, dedup_key) where is_deleted = false;
```

- [ ] **Step 2: Write the failing IT.** Mirror `PushSubscriptionRepositoryIT` (same package) for shape, including its private `ownerId()` helper. Cover: a pref upsert leaves one row; a soft-deleted pref does not block re-insert; `existsByCreatedByAndLogDateAndDedupKey` is true after a log write and false for another day.
- [ ] **Step 3: Run it and watch it fail.** `cd backend && ./mvnw clean test -Dtest=NotificationPrefRepositoryIT` — expect a compile failure.
- [ ] **Step 4: Write the two entities.** Mirror `PushSubscriptionEntity` exactly (extends `OwnedEntity`, `@SQLDelete`/`@SQLRestriction` with the right table name, `@Column` lengths matching the DDL **exactly** — a `varchar(24)` column needs `length = 24`).
- [ ] **Step 5: Write the two repositories.** Plain `JpaRepository` (neither entity has a `date` field named `date`, so `OwnedRepository`'s JPQL would not compile — the `PushSubscriptionRepository` precedent).
- [ ] **Step 6: Add both tables to `ResetDatabase`'s TRUNCATE list** (next to `push_subscription`).
- [ ] **Step 7: Extend `NotificationPopulator`** with `pref(UUID owner, String category, boolean enabled, int leadMinutes)` and `pushLog(UUID owner, LocalDate date, String dedupKey, String category)`, both `saveAndFlush`.
- [ ] **Step 8: Run the tests — expect green.** Then commit.

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/notification backend/src/test/java/io/mrkuhne/mezo
git commit --no-verify -m "feat(notification): notification_pref + push_log tables (mezo-h4wp.6.2)"
```

---

### Task 3: The category catalog

**Files:** Create `feature/notification/domain/NotificationCategory.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/notification/NotificationCategoryTest.java`.

**Interfaces produced:** `enum NotificationCategory` with `String key()`, `boolean defaultEnabled()`, `int defaultLeadMinutes()`, `boolean feWritten()`, and `static Optional<NotificationCategory> fromKey(String)`.

- [ ] **Step 1: Write the failing test.** It must pin **every row of spec §6** — the 11 keys, which 7 default ON, the two non-zero default leads, and which 2 are FE-written. This test is the guardrail that stops a later slice from quietly flipping a default:

```java
package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

class NotificationCategoryTest {

    @Test
    void testValues_shouldMatchTheSpecCatalog_whenListed() {
        assertThat(Arrays.stream(NotificationCategory.values()).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("briefing", "gym", "medication", "ritual", "lights_out",
                "weekly", "memoir", "wind_down", "midday", "checkin", "fuel_slot");
    }

    @Test
    void testDefaultEnabled_shouldBeTheSevenSpecDefaults_whenFiltered() {
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(NotificationCategory::defaultEnabled).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("briefing", "gym", "medication", "ritual", "lights_out",
                "weekly", "memoir");
    }

    @Test
    void testDefaultLeadMinutes_shouldBeThirtyForGymAndZeroElsewhere_whenRead() {
        assertThat(NotificationCategory.GYM.defaultLeadMinutes()).isEqualTo(30);
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(c -> c != NotificationCategory.GYM)
                .allMatch(c -> c.defaultLeadMinutes() == 0)).isTrue();
    }

    @Test
    void testFeWritten_shouldBeCheckinAndFuelSlot_whenFiltered() {
        assertThat(Arrays.stream(NotificationCategory.values())
                .filter(NotificationCategory::feWritten).map(NotificationCategory::key))
            .containsExactlyInAnyOrder("checkin", "fuel_slot");
    }

    @Test
    void testFromKey_shouldBeEmpty_whenKeyIsUnknown() {
        assertThat(NotificationCategory.fromKey("nope")).isEmpty();
        assertThat(NotificationCategory.fromKey("gym")).contains(NotificationCategory.GYM);
    }
}
```

`wind_down`'s offset is **not** a notification lead — it comes from `mezo.ritual.prep-lead-min`. Its `defaultLeadMinutes()` is 0; do not duplicate the ritual offsets here (spec §9).

- [ ] **Step 2: Run it and watch it fail.** `-Dtest=NotificationCategoryTest`.
- [ ] **Step 3: Implement the enum** so all five tests pass. Give each constant a javadoc line naming its anchor source, and add a class-level javadoc pointing at spec §6 as the source of truth.
- [ ] **Step 4: Run — green. Commit.**

```bash
git commit --no-verify -m "feat(notification): the 11-category catalog with spec-pinned defaults (mezo-h4wp.6.2)"
```

---

### Task 4: `DueEvaluator` — the pure due-computation

**Files:** Create `feature/notification/domain/{DueItem,CategoryPref,AnchorSet}.java` and `feature/notification/service/DueEvaluator.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/notification/DueEvaluatorTest.java`.

**Interfaces produced:**

```java
public record DueItem(NotificationCategory category, int minuteOfDay, String dedupKey,
                      String title, String body, String url) {}

public record CategoryPref(NotificationCategory category, boolean enabled, int leadMinutes) {}

/** Everything the evaluator needs, already read. `null`/empty means "unavailable" — never fabricated. */
public record AnchorSet(
    List<AnchoredEvent> backendAnchors,     // gym, ritual, lights_out, wind_down, medication
    List<AnchoredEvent> proseAnchors,       // briefing, midday, weekly, memoir — only when the row EXISTS
    List<AnchoredEvent> scheduleAnchors) {  // checkin, fuel_slot — from notification_schedule
    public record AnchoredEvent(NotificationCategory category, int minuteOfDay,
                                String dedupSuffix, String title, String body, String url) {}
}

// DueEvaluator — a @Component with NO collaborators, so it is trivially unit-testable.
public List<DueItem> due(int nowMinuteOfDay, List<CategoryPref> prefs, AnchorSet anchors, int catchUpMinutes)
```

- [ ] **Step 1: Write the failing table test.** The formula is N1's proven one, ported from `weekly-planner`: an item fires when `(anchorMinute - leadMinutes) - nowMinute ∈ [0, catchUpMinutes)`. Cover, one test each: exact minute fires; one minute late still fires (catch-up 2); two minutes late does **not**; a future minute does not; a **disabled** category never fires even when due; the lead shifts the fire minute (gym 17:30 with lead 30 fires at 17:00); an unavailable anchor yields nothing; an empty pref list yields nothing; the `dedupKey` is `"{category.key()}:{anchorHHmm}"` and is stable across two calls in the same minute; and — the one that protects against a wrap-around bug — an anchor at `00:10` with a 30-minute lead does **not** fire at `23:40` the previous evening (negative minute-of-day must not be reinterpreted).

Write the tests as a parameterised table where it reads better, but each assertion must name the scenario. **No Spring context** — construct `DueEvaluator` with `new`.

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement.** Pure; no clock, no repository, no I/O. Build the `dedupKey` from the category key + the **anchor** time (not the fire time, so changing the lead does not re-fire a notification already sent today).
- [ ] **Step 4: Run — green. Commit.**

```bash
git commit --no-verify -m "feat(notification): pure DueEvaluator with catch-up window (mezo-h4wp.6.2)"
```

---

### Task 5: `AnchorResolver` — the impure half

**Files:** Create `feature/notification/service/AnchorResolver.java`; test `backend/src/test/java/io/mrkuhne/mezo/feature/notification/AnchorResolverIT.java`.

**Interfaces produced:** `AnchorSet resolve(UUID owner, LocalDate date)` — gated on `NOTIFICATION_SWITCH`.

- [ ] **Step 1: Write the failing IT.** Extend `AbstractIntegrationTest`. Using the real populators, cover: a gym slot on today's weekday appears with the right minute-of-day **and the 0-based→ISO weekday conversion is correct** (populate a slot for each of the 7 days and assert exactly the right one resolves — this is the off-by-one guard); a persisted `briefing` row produces a prose anchor while its absence produces none; `medication` with `retaDay == 0` produces **no** anchor; a `notification_schedule` row with `weekday = null` resolves on any day while a specific weekday resolves only on that day.
- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement**, using the exact reads in the **Anchor facts** table above. Non-negotiables:
  - Weekday: `date.getDayOfWeek().getValue() - 1` to compare against `gym_schedule_slot.dayOfWeek`; the wire/`notification_schedule` `weekday` is ISO 1-7 and compares to `getValue()` directly.
  - `RitualService` via `ObjectProvider<RitualService>`; `getIfAvailable() == null` ⇒ no ritual/wind_down/lights_out anchors.
  - **Never** call `WorkoutService.getToday(...)`; use `findPlannedTemplateForDate(owner, date)` for the gym notification's title.
  - Prose anchors exist **only** when the content row exists. Excerpt the body to `mezo.notification.prose-excerpt-chars` (160) at a **word boundary**, and reuse `PushSender`'s existing surrogate-safe truncation approach rather than a second `substring`.
  - Titles/bodies in **Hungarian**, following the mockup's per-category copy and spec §6's copy rules: never report a missed thing as a failure, never invent a number, exactly one tap target, and the medication push reminds without suggesting a dose.
- [ ] **Step 4: Run — green. Commit.**

```bash
git commit --no-verify -m "feat(notification): anchor resolution for the 11 categories (mezo-h4wp.6.2)"
```

---

### Task 6: Pref service + API

**Files:** Create `feature/notification/service/NotificationPrefService.java` and `controller/NotificationPrefController.java`; modify `messages.properties`; test `NotificationPrefApiIT.java`.

**Interfaces produced:** `List<CategoryPref> effectiveFor(UUID owner)` (all 11, stored row or code default), `void upsert(UUID owner, List<CategoryPref>)`.

- [ ] **Step 1: Write the failing API IT.** Extend `ApiIntegrationTest`. Cover: a fresh user's `GET` returns **all 11** categories with the spec defaults; `PUT` then `GET` round-trips a changed toggle and lead; `PUT` twice with the same category leaves **one** row; an unknown category key is a **400** with code `NOTIFICATION_UNKNOWN_CATEGORY` (assert via the `SystemMessage` helper `ApiIntegrationTest` already provides); unauthenticated is 401.
- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement.** `NOTIFICATION_UNKNOWN_CATEGORY` goes in `messages.properties` with a 400 status — this is genuinely client-supplied material, matching the branch's established split. `effectiveFor` merges stored rows over `NotificationCategory` defaults; `upsert` is an upsert per category (the partial unique index makes a blind insert throw).
- [ ] **Step 4: Run — green. Commit.**

```bash
git commit --no-verify -m "feat(notification): per-category preference API with lazy defaults (mezo-h4wp.6.2)"
```

---

### Task 7: `NotificationDispatchJob`

**Files:** Create `feature/notification/service/NotificationDispatchJob.java`; modify `NotificationProperties` + `application.yml`; test `NotificationDispatchJobIT.java`.

**Interfaces produced:** none consumed downstream; this is the top of the chain.

- [ ] **Step 1: Extend `NotificationProperties`** with `String dispatchCron`, `int catchUpMinutes`, `String medicationTime`, `int proseExcerptChars` (keep `bodyMaxChars`), each `@Validated`-constrained. Add to `application.yml` under `mezo.notification`: `dispatch-cron: "0 * * * * *"`, `catch-up-minutes: 2`, `medication-time: "08:00"`, `prose-excerpt-chars: 160`. **Flip `mezo.techcore.cron.notification-dispatch-job.enabled` to `true`.**
- [ ] **Step 2: Write the failing IT.** Do **not** try to assert on a real cron firing. Extract the body into a testable method — `int runOnce(LocalDate date, int minuteOfDay)` — and have the `@Scheduled` method call it with the real clock. Then cover: a due item writes a `push_log` row and reports one dispatch; running the **same minute twice** dispatches only once (the dedup); a disabled category dispatches nothing; a user whose resolver throws does not stop the next user (populate two users, make one's data broken, assert the other still dispatched); and the `push_log` row is written **before** the send is handed off.
- [ ] **Step 3: Run and watch it fail.**
- [ ] **Step 4: Implement.** Structure, in this order — it matters:
  1. `@Scheduled(cron = "${mezo.notification.dispatch-cron}")`, gated `@ConditionalOnProperty` on **both** `NOTIFICATION_SWITCH` and `NOTIFICATION_DISPATCH_JOB_SWITCH` (the proactive three-switch idiom).
  2. Per user, in a try/catch that logs and continues (the `ChallengeJob` idiom).
  3. `AnchorResolver.resolve` → `NotificationPrefService.effectiveFor` → `DueEvaluator.due`.
  4. Filter out anything already in today's `push_log`.
  5. **Write the `push_log` row, then hand the send to the async executor** — the scheduler pool is size 1 and this method must return in milliseconds. Use the existing `AsyncConfiguration` executor (check its bean/qualifier name and use it; do not create a second executor).
  6. Log a one-line summary per run at `info` with counts only — **never an endpoint**.
- [ ] **Step 5: Run — green.** Also run `-Dtest='Notification*,PushSender*,PushSubscription*,DueEvaluator*,AnchorResolver*,ArchitectureTest'` and paste the output.
- [ ] **Step 6: Commit.**

```bash
git commit --no-verify -m "feat(notification): per-minute dispatch job with async send handoff (mezo-h4wp.6.2)"
```

---

### Task 8: Frontend — pref hooks + the category list

**Files:** Create `src/data/notification/notificationPrefHooks.ts`, `src/features/me/components/NotificationCategoryRow.tsx` (+ colocated tests); modify `notificationApi.ts`, `data/hooks.ts`, `data/types.ts`, `NotificationsPage.tsx`.

**Interfaces produced:** `useNotificationPrefs(): { prefs: NotificationPrefView[]; isPending: boolean; setPref: (category, patch) => Promise<void> }`.

- [ ] **Step 1: Add the domain type to `data/types.ts`** — `NotificationPrefView { category: string; enabled: boolean; leadMinutes: number }` plus a `NOTIFICATION_CATEGORY_META` map (Hungarian label, emoji, section, and whether a lead chip is shown) so the UI never hardcodes copy inline. Section values: `'prose' | 'reminder'` — the mockup's two headings („Mezo megszólal" / „Emlékeztetők").
- [ ] **Step 2: Extend `notificationApi.ts`** with `prefs()` and `putPrefs(body)`, wire types from `api.gen.ts`, `satisfies` on the request body.
- [ ] **Step 3: Write the failing hook test.** Mock mode returns a deterministic seed of all 11 with the spec defaults and never calls the network; real mode maps the wire list. `setPref` optimistically updates and invalidates.
- [ ] **Step 4: Run both modes and watch it fail.**
- [ ] **Step 5: Implement the hook.** Use `useDualQuery` for the read (this one **is** a server-owned read, unlike N1's device-owned `usePushSubscription`) and `useMutation` for the write. Re-export through `@/data/hooks`.
- [ ] **Step 6: Write `NotificationCategoryRow`** — presentational: icon, label, derived sub-line, optional lead chip, and the `Toggle` primitive (which now takes `disabled`). No `@/data/*` import.
- [ ] **Step 7: Extend `NotificationsPage`** to render the two sections from the mockup, each row a `NotificationCategoryRow`, below the existing master toggle and test button. The install gate still replaces everything when not standalone.
- [ ] **Step 8: Write the failing page test,** then make it pass: all 11 rows render grouped into the two sections; toggling a row calls `setPref`; the rows are absent when the install gate is showing.
- [ ] **Step 9: Full gate** — `pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`. Commit.

```bash
git commit --no-verify -m "feat(notification): settings category list over per-category prefs (mezo-h4wp.6.2)"
```

---

### Task 9: `notification_schedule` + the write API (N3 starts)

**Files:** Create migration `202607291500_mezo-h4wp.6.3_create_notification_schedule.sql`; entity + repository; `NotificationScheduleService`; `NotificationScheduleController`; extend `ResetDatabase` + `NotificationPopulator`; test `NotificationScheduleApiIT.java`.

- [ ] **Step 1: Write the migration.** Columns per spec §5: `weekday smallint` (**nullable — null means every day**), `time varchar(5)`, `category varchar(24)`, `title varchar(120)`, `body varchar(300)`, `deeplink varchar(200)`, `source varchar(24)`, plus the `OwnedEntity` set. Constraints: `pk_`, `fk_`, `ck_notification_schedule_weekday check (weekday between 1 and 7)`, and a non-unique `idx_notification_schedule_created_by_category`. **No unique index** — a category legitimately has many rows.
- [ ] **Step 2: Write the failing API IT.** Cover: a `PUT` stores the entries; a second `PUT` for the **same category** replaces them (the old rows are soft-deleted, the live set is exactly the new one); a `PUT` naming a category with **no** entries clears it; a category the FE does not own (e.g. `gym`) is rejected **400** — only `feWritten()` categories are accepted, because letting the client write a backend-native category's schedule would create a second source of truth; unknown category 400; unauthenticated 401.
- [ ] **Step 3: Run and watch it fail.**
- [ ] **Step 4: Implement.** Replacement is per category inside one `@Transactional` method: soft-delete the category's live rows, insert the new set (the `briefing` regeneration precedent — a soft-deleted row never blocks reinsertion).
- [ ] **Step 5: Run — green. Commit.**

```bash
git commit --no-verify -m "feat(notification): FE-written recurring schedule snapshot (mezo-h4wp.6.3)"
```

---

### Task 10: Frontend — the schedule writer + the last two categories

**Files:** Create `src/data/notification/notificationScheduleWriter.ts` (+ test); modify `notificationApi.ts`, `data/hooks.ts`, and the app-open site.

- [ ] **Step 1: Decide and document where the app-open write belongs.** Read `src/app/AppLayout.tsx` and the providers under `src/app/providers/` and pick the single mount point that runs once per app open. State your choice and why in your report.
- [ ] **Step 2: Write the failing test** for a pure `buildScheduleEntries(...)` function: given the four check-in slot times from `@/data/today/checkins.ts` and the protocol slots from `buildProtocol`, it emits `NotificationScheduleEntry[]` with `weekday: null` (every day), the right `category`, Hungarian `title`/`body`, the right `deeplink` (`/today` + check-in sheet, `/fuel/stack`), and `source` (`checkinSlots` / `buildProtocol`). Assert times are `HH:mm` and bodies are within 300 chars.
- [ ] **Step 3: Run both modes — fails. Step 4: Implement** the pure builder, reusing the existing FE logic as the input rather than re-deriving times.
- [ ] **Step 5: Wire the writer:** on app open, in **real mode only**, `PUT /api/notification/schedule` with `categories: ['checkin','fuel_slot']` and the built entries. Fire-and-forget with a caught failure (a failed snapshot write must never break app start), and **do not** run it in mock mode. Guard against writing on every render — once per mount.
- [ ] **Step 6: Full gate** (`data/hooks.ts` is touched, so the whole suite). Commit.

```bash
git commit --no-verify -m "feat(notification): app-open schedule snapshot writer for check-in + fuel slots (mezo-h4wp.6.3)"
```

---

### Task 11: The preview header

**Files:** Create `src/features/me/logic/notificationForecast.ts` + test, `src/features/me/components/NotificationPreviewHeader.tsx` + test; modify `NotificationsPage.tsx`.

- [ ] **Step 1: Write the failing forecast test.** `forecastToday(prefs, scheduleEntries, anchors, weekday)` → `{ total: number; perHour: number[] /* length 24 */; denseWindows: Array<{fromHHmm, toHHmm, count}> }`. **Needs no new endpoint** — the FE already knows today's gym time, bed anchor and ritual window from existing hooks. Cover: only enabled categories count; the gym lead shifts its hour bucket; a `weekday: null` schedule row counts every day while a specific weekday counts only on that day; two items within 15 minutes produce a dense window; an empty pref set yields `total: 0` and all-zero buckets. Pass the clock/anchors in — **no `new Date()` inside the pure function**, so the test is deterministic.
- [ ] **Step 2: Run — fails. Step 3: Implement** the pure function.
- [ ] **Step 4: Write `NotificationPreviewHeader`** — the mockup's dark card: „NAPI TERHELÉS", the `N / nap` count, the 24-bucket sparkline, and the dense-window warning line when one exists. Presentational; takes the forecast as a prop.
- [ ] **Step 5: Mount it** at the top of `NotificationsPage`, above the install gate/master toggle, reading the forecast from the prefs + schedule the page already has.
- [ ] **Step 6: Full gate.** If a visual golden exists for `/me/ertesitesek`, do **not** regenerate it — report it instead; a sparkline derived from wall-clock is a flaky-golden risk and the forecast is unit-tested for that reason. Commit.

```bash
git commit --no-verify -m "feat(notification): live volume-preview header on the settings screen (mezo-h4wp.6.3)"
```

---

### Task 12: Documentation

**Files:** Modify `docs/features/_platform-notifications.md`, `docs/features/proactive.md`, `docs/milestones/roadmap.md`, and any `docs/features/*.md` whose `key_files` this branch touched.

- [ ] **Step 1: Update `_platform-notifications.md`** — the dispatcher, the pref + log + schedule tables, the 11 categories now live, the settings screen, and the **scheduler-pool-of-1 gotcha with the async handoff** (a future maintainer inlining the send would silently starve 18 crons). Keep spec §6's copy rules verbatim. Overwrite in place; no changelog section.
- [ ] **Step 2: Now flip the deferred rows** — this is the slice where H2 is genuinely complete: `docs/features/proactive.md`'s epic-status rows and §1 header, and `docs/milestones/roadmap.md`'s Phase-4 "**Web Push infra H2 DEFERRED**". State plainly what is live.
- [ ] **Step 3: Run `node scripts/lint-docs.mjs`** and close any staleness **this branch caused** (compare each flagged doc's stale `key_files` against `git diff --name-only origin/main..HEAD`). Do **not** date-bump a doc you make no real edit to, and do not touch staleness that predates the branch — `growth.md`/`ritual.md`/`insights.md` are tracked separately in bd.
- [ ] **Step 4: Commit.**

```bash
git commit --no-verify -m "docs(notification): dispatcher + 11 categories live; H2 no longer deferred (mezo-h4wp.6.3)"
```

---

### Task 13: Ship

- [ ] **Step 1:** `git log --oneline origin/main..HEAD` and confirm no root-level `issues.jsonl` in `git diff --name-only origin/main..HEAD`.
- [ ] **Step 2:** push, `gh pr create`, `gh pr checks --watch`. A CONFLICTING PR gets **no CI run at all** — merge `origin/main` into the branch (not rebase) and resolve `.beads/issues.jsonl` via `bd dolt pull && bd export -o .beads/issues.jsonl`.
- [ ] **Step 3:** If `test-visual` is red, regenerate **linux** with `gh workflow run update-visual-baselines.yml -r <branch>`, approve the resulting `action_required` run, then `git pull`. Commit only goldens this change legitimately moved.
- [ ] **Step 4:** merge `--no-ff`, push `main`, delete the branch, `bd close mezo-h4wp.6.2 mezo-h4wp.6.3`, `bd dolt push && git push`.
- [ ] **Step 5:** **Verify on the phone** — the dispatcher is live the moment main deploys, so the next anchor should produce a real notification without anyone pressing a button. Confirm one arrives, then confirm the settings toggles change what arrives.
