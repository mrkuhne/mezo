# Proactive Coaching S3 — Setup Checks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit a weekly-at-most **setup card** when the user's *configuration* contradicts what the coaching layer needs — a missing `sleep_goal`, and a sleep plan that cannot fit the user's own evening schedule.

**Architecture:** Slice S3 of `docs/superpowers/specs/2026-09-03-proactive-coaching-round1-design.md` §3 item 2 and the §4 "Setup checks" table. These are **not flags**: they read configuration rather than metric series, they are evaluated by their own daily cron rather than the flag spine, and they emit a **new `companion_message` kind, `setup`**, which the spec's §4 severity table treats as its own tier. Delivery reuses the `InterventionService` card idiom wholesale (feed row + envelope key + per-key cooldown); no LLM call anywhere in this slice.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, contract-first OpenAPI fragments (`api/feature/*/*.yml`), React/TS frontend, JUnit ITs extending `AbstractIntegrationTest`.

## Decisions already made — do not re-litigate

- **The card kind is a new `setup`** (user decision, 2026-09-03), NOT a reuse of `intervention` and NOT an early build of S4's `advice`. The spec's severity order lists "setup cards" as their own tier below every flag, which is what makes them a distinct kind.
- **"Earliest morning obligation" resolves to `gym_schedule_slot.time`**, which is a real `HH:mm` column, with the sleep goal's `WAKE` `anchorTime` as the fallback. A recon pass initially reported this concept as absent from the codebase; that was wrong — gym slots carry clock times, and the spec's own §0 evidence cites "Mon–Fri 07:00 slots". Do not go looking for a calendar or appointment entity; there isn't one and this slice does not add one.
- **Check 6 (plan feasibility) requires a `sleep_goal` row.** When there is none, check 4 owns the story and check 6 stays silent — the same "one detector owns the narrative" shape S2 used for `logging_gap` vs. `sleep_debt`.

## Global Constraints

- **Adding a `companion_message` kind needs FOUR mirrored changes** (the S2 lesson, re-derived for this table): (a) the `KIND_*` constant on `CompanionMessageEntity`; (b) the `ck_companion_message_kind` DB CHECK, widened by a NEW Liquibase changeset (drop + re-add, never edit the original); (c) the `enum:` list on `FeedMessageResponse.kind` in `api/feature/proactive/proactive.yml`; (d) the `FeedMessageKind` union in `frontend/src/data/types.ts`. `api/openapi.yml` and `frontend/src/data/_client/api.gen.ts` are GENERATED from (c) — regenerate, never hand-edit, or the `contract-drift` CI job fails.
- **Never detect a missing sleep goal through `SleepGoalService` or `SleepAnchorResolver`.** Both deliberately fall back to a config-default ghost (`SleepGoalProperties.default*`), so `GET /api/sleep/goal` always 200s with a plausible goal and the missing-row condition is invisible there. The FE ghosts it too (`frontend/src/data/me/sleepGoal.ts`). Check 4 must call `SleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()` directly. This is the single sharpest trap in the slice.
- **Every threshold, buffer and cadence lives in config**, never in code — a new `@ConfigurationProperties` record, per the `FlagProperties` precedent ("a feature-scoped record rather than another field on the already-large shared `CompanionProperties`"). `CompanionProperties` is 344 lines and belongs to the wrong feature; `ProactiveProperties` already carries 7 nested records. S3 gets its own.
- **ArchUnit:** `no_spring_value_annotation` (config MUST be a `*Properties` record), `services_live_in_service_packages`, `entities_live_in_entity_packages`, `no_field_injection`, `no_class_level_transactional`, `controllers_implement_generated_api`. `feature_slices_are_cycle_free` is a **frozen** rule — S3 adds no endpoint and no new feature edge (`proactive → biometrics` and `proactive → train` both already exist), but ArchUnit does NOT run in focused local runs, so CI is the gate.
- **`ProactiveFeedService.getFeed` is deliberately NOT `@Transactional`** — do not call setup checks from inside it. Setup checks are cron-only; the emitter carries its own method-level `@Transactional`, exactly like `InterventionService.deliverForFlag`.
- **`sleep_log.date` is the WAKE-UP MORNING**, so the bedtime on the row dated Tuesday is Monday night's. `MetricKey.BEDTIME_HOUR`'s extractor shifts clock hours below 12 by +24 (a 00:30 bedtime reads as 24.5), so bedtimes that cross midnight sort on one number line — the median must be computed on those shifted values, never on raw wall-clock.
- `MetricKey` is APPEND-ONLY — S3 adds none (`BEDTIME_HOUR` already exists).
- Liquibase changesets are immutable; the new file's timestamp must exceed `202609031300`.
- Focused tests locally; CI's self-PR is the authoritative full suite + ArchUnit + contract-drift + CODEMAP gate. **Local runs need `-Dmezo.test.use-testcontainers=true`.** Frontend tests must pass in BOTH modes — `VITE_USE_MOCK` unset means MOCK, so the real-mode run must set it explicitly.
- Run all commands from the repo root of the executing worktree; never `cd` to the primary repo (it has `main` checked out).
- Commit messages: conventional subject + the driving bd id + a `Co-Authored-By:` trailer for the acting model.
- After creating/moving files: `node scripts/gen-codemap.mjs`, committed in the same change.

---

### Task 0: bd issue + branch

**Files:** none (process).

- [ ] **Step 1: Claim the driving bd issue**

The issue already exists: **`mezo-d58h.3`**. `<BD-ID>` in every commit below means `mezo-d58h.3`.

```bash
bd update mezo-d58h.3 --claim
```

- [ ] **Step 2: Create the feature branch**

```bash
git checkout -b feat/proactive-coaching-s3
```

---

### Task 1: The `setup` message kind

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEnvelope.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609040900_mezo-d58h.3_companion_message_setup_kind.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `api/feature/proactive/proactive.yml`
- Modify: `frontend/src/data/types.ts`
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessagePersistenceIT.java` (find the existing persistence IT for this table; if the class name differs, use the real one)

**Interfaces:**
- Produces: `CompanionMessageEntity.KIND_SETUP = "setup"`; `CompanionMessageEnvelope`'s new `setupKey` component with the 5-arg canonical constructor and the existing shorter constructors preserved. Tasks 3 and 4 write rows with both.

This task ships no check — its deliverable is that the kind exists end to end (DB accepts it, the contract exposes it, the FE type admits it) and that a `setup` row round-trips through jsonb with a `setupKey`.

- [ ] **Step 1: Run the existing proactive ITs — green before anything**

```bash
cd backend && ./mvnw test -Dtest='InterventionServiceIT,ProactiveApiFeedIT,CompanionMessage*IT' -q -Dmezo.test.use-testcontainers=true
```

Expected: all pass. If not, STOP — investigate before adding to a broken baseline.

- [ ] **Step 2: Add the kind constant**

In `CompanionMessageEntity`, after `KIND_PEOPLE`:

```java
    /** Setup card (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table): the user's CONFIGURATION
     *  contradicts what coaching needs (no sleep goal; a sleep plan that cannot fit the evening
     *  schedule). Config text, never LLM-generated; the envelope carries {@code setupKey} so the
     *  weekly re-emit cooldown can be keyed per check. */
    public static final String KIND_SETUP = "setup";
```

- [ ] **Step 3: Add `setupKey` to the envelope**

Replace `CompanionMessageEnvelope`'s record header and constructors with:

```java
public record CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                       String interventionKey, String setupKey) {

    /** The pre-W5.2 shape — every non-intervention, non-setup writer stays on this. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs) {
        this(eyebrow, body, refs, null, null);
    }

    /** The W5.2 intervention shape — kept so existing call sites compile unchanged. */
    public CompanionMessageEnvelope(String eyebrow, List<String> body, List<Ref> refs,
                                    String interventionKey) {
        this(eyebrow, body, refs, interventionKey, null);
    }

    public record Ref(String kind, String label) {
    }
}
```

Extend the class javadoc's `interventionKey` sentence with: `{@code setupKey} (S3, bd mezo-d58h.3) is set ONLY on {@code kind=setup} rows — it names the check ({@code missing_sleep_goal} / {@code plan_feasibility}) so the weekly re-emit cooldown can be keyed per check; null on every other kind (old rows deserialize to null).`

Adding the 4-arg constructor back explicitly is what keeps `InterventionService`'s existing call site compiling untouched — do not change that call site.

- [ ] **Step 4: Widen the DB CHECK**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609040900_mezo-d58h.3_companion_message_setup_kind.sql` (mirroring `202609021000_mezo-06o0.8_companion_message_people_kind.sql`, which is the template for this exact operation):

```sql
-- Proactive coaching S3 (mezo-d58h.3, spec 2026-09-03 §4 setup table): the 'setup' kind carries
-- CONFIGURATION cards — no sleep goal, an infeasible sleep plan — not observations about a day.
-- Config text, never LLM output. The (created_by, message_date, kind) partial unique index
-- applies to it like every other kind, so at most one setup card per user per day.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people','setup'));
```

Append to `1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609040900_mezo-d58h.3_companion_message_setup_kind"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609040900_mezo-d58h.3_companion_message_setup_kind.sql
```

Before writing, `ls backend/src/main/resources/db/changelog/1.0.0/script/ | sort | tail -3` and bump the timestamp if anything already exceeds `202609040900`; report it if you do.

- [ ] **Step 5: Widen the contract enum**

In `api/feature/proactive/proactive.yml`, `FeedMessageResponse.kind` (around line 453) — replace the `description` and `enum` lines with:

```yaml
          description: Feed message kind — morning, sleep, weight, midday, evening, or people LLM-generated messages; intervention is config text (mezo.companion.interventions) and setup is config text for a configuration gap (mezo.proactive.setup-checks), neither ever LLM output.
          enum: [morning, sleep, weight, midday, evening, intervention, people, setup]
```

- [ ] **Step 6: Widen the FE union and regenerate both artifacts**

`frontend/src/data/types.ts:17`:

```ts
export type FeedMessageKind = 'morning' | 'sleep' | 'weight' | 'midday' | 'evening' | 'intervention' | 'people' | 'setup'
```

Then regenerate — hand-editing either generated file fails the `contract-drift` gate:

```bash
cd api/generate && npm ci && npm run generate:api
cd ../../frontend && pnpm install --frozen-lockfile && pnpm generate:api
```

No FE render branch is needed: `feedToMessageItem` in `frontend/src/features/today/logic/mezoMessages.ts` maps any kind generically (`id: m.kind`, eyebrow/body/refs 1:1), and the only kind-specific branch is `MezoMessagesSheet`'s „Segített?" label for `intervention`. A `setup` card renders as an ordinary thread bubble, which is correct for S3 — S5 owns action buttons.

- [ ] **Step 7: Extend the persistence test**

Find the IT that round-trips `companion_message` rows (`CompanionMessage*IT` under `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/`), read it, and add a test in its existing style asserting that a `setup`-kind row with a `setupKey` in its envelope persists and reads back. If the file has a raw-insert helper (the `FlagLogPopulator.rawInsert` idiom), use it to pin the DB CHECK itself, not just Bean Validation. Mirror `CompanionMessagePopulator`'s existing factories rather than hand-building entities where a factory exists.

- [ ] **Step 8: Run the tests**

```bash
cd backend && ./mvnw test -Dtest='InterventionServiceIT,ProactiveApiFeedIT,CompanionMessage*IT' -q -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test
```

Expected: PASS. A CHECK-constraint violation means the migration did not run — verify the changeset registration and filename match.

- [ ] **Step 9: Commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src/main/java backend/src/main/resources backend/src/test api frontend/src docs/CODEMAP.md
git commit -m "feat(proactive): setup companion-message kind + envelope setupKey (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 2: `SetupCheckProperties` config

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/SetupCheckProperties.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: wherever `@ConfigurationPropertiesScan` / `@EnableConfigurationProperties` registers the other `*Properties` records — check how `ProactiveProperties` and `FlagProperties` are picked up and follow the same mechanism exactly.
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/SetupCheckPropertiesIT.java`

**Interfaces:**
- Produces: `SetupCheckProperties` with `cron`, `reEmitHours`, and nested `PlanFeasibility(wakeBufferMin, commuteBufferMin, morningCutoffHour, misfitToleranceMin, bedtimeWindowDays, minBedtimeSamples)`. Tasks 3-5 read all of it.

- [ ] **Step 1: Write the properties record**

```java
package io.mrkuhne.mezo.feature.proactive.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Setup-check tuning (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table) — EVERY threshold,
 * buffer and cadence is config, never code. Own record rather than another field on the
 * already-large CompanionProperties or ProactiveProperties: the FlagProperties precedent.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.proactive.setup-checks")
public record SetupCheckProperties(

    /** Daily schedule for the setup-check pass. */
    @NotBlank String cron,

    /** A setup card for the SAME check does not repeat inside this window — the spec's
     *  "at most weekly until the configuration contradicts them" cadence. */
    @Min(1) @Max(8760) int reEmitHours,

    @NotNull @Valid PlanFeasibility planFeasibility
) {

    public record PlanFeasibility(
        /** Minutes needed between waking and the morning obligation itself (shower, travel,
         *  breakfast) — the plan must leave room for this, not just for sleep. */
        @Min(0) @Max(240) int wakeBufferMin,
        /** Minutes between an evening sport slot ending and actually being home. sport_schedule_slot
         *  carries a free-text location and nothing geocoded, so this is one flat config number. */
        @Min(0) @Max(240) int commuteBufferMin,
        /** A gym slot at or before this hour counts as a MORNING obligation; later slots are
         *  evening training and do not constrain lights-out. */
        @Min(1) @Max(23) int morningCutoffHour,
        /** The plan is called infeasible only when it misses by MORE than this (spec: 45'). */
        @Min(5) @Max(240) int misfitToleranceMin,
        /** Trailing days of bedtime history the observed median is taken over. */
        @Min(3) @Max(90) int bedtimeWindowDays,
        /** Honest gate: fewer logged bedtimes than this in the window ⇒ the observed-bedtime
         *  half of the check stays silent (the schedule half can still speak). */
        @Min(2) @Max(30) int minBedtimeSamples
    ) {
    }
}
```

- [ ] **Step 2: Add the yaml defaults**

Under `mezo.proactive` in `application.yml` (find the block that holds the other `mezo.proactive.*` settings and add a sibling; match the surrounding indentation and comment voice):

```yaml
    setup-checks:
      # S3 (mezo-d58h.3, spec 2026-09-03 §4 setup table): checks against CONFIGURATION, not
      # against a day's data — so they run once daily and re-emit at most weekly until the
      # configuration stops contradicting them. Config text, never an LLM call.
      # 06:10 — after the 05:45 morning message job, so a setup card lands below the briefing.
      cron: "0 10 6 * * *"
      # "At most weekly": 7 days.
      re-emit-hours: 168
      plan-feasibility:
        # Wake → out-the-door: shower, breakfast, travel to the morning obligation.
        wake-buffer-min: 45
        # Sport slot end → home. sport_schedule_slot.location is free text, never geocoded,
        # so one flat number is the honest granularity.
        commute-buffer-min: 30
        # A gym slot at or before 10:00 is a morning obligation; later ones are evening training.
        morning-cutoff-hour: 10
        # Spec §4: "if the plan misses by >45′".
        misfit-tolerance-min: 45
        bedtime-window-days: 14
        # Fewer than 4 logged bedtimes ⇒ the observed-bedtime half stays silent.
        min-bedtime-samples: 4
```

- [ ] **Step 3: Write the binding test**

Create `SetupCheckPropertiesIT` following `FlagPropertiesIT`'s shape (read it first — same package layout, same `@Autowired` properties style):

```java
    @Test
    void testSetupCheckProperties_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.cron()).isEqualTo("0 10 6 * * *");
        assertThat(properties.reEmitHours()).isEqualTo(168);
        assertThat(properties.planFeasibility().wakeBufferMin()).isEqualTo(45);
        assertThat(properties.planFeasibility().commuteBufferMin()).isEqualTo(30);
        assertThat(properties.planFeasibility().morningCutoffHour()).isEqualTo(10);
        assertThat(properties.planFeasibility().misfitToleranceMin()).isEqualTo(45);
        assertThat(properties.planFeasibility().bedtimeWindowDays()).isEqualTo(14);
        assertThat(properties.planFeasibility().minBedtimeSamples()).isEqualTo(4);
    }
```

- [ ] **Step 4: Run it**

```bash
cd backend && ./mvnw test -Dtest='SetupCheckPropertiesIT,FlagPropertiesIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS. A binding failure usually means the record is not being scanned — compare against how `ProactiveProperties` is registered.

- [ ] **Step 5: Commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src docs/CODEMAP.md
git commit -m "feat(proactive): SetupCheckProperties — cadence, buffers and feasibility tolerance (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 3: `SetupCheckService` + the missing-sleep-goal check + the daily job

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckService.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckJob.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/SetupCheckServiceIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/SetupCheckJobSwitchOffIT.java`

**Interfaces:**
- Consumes: `CompanionMessageEntity.KIND_SETUP` and the envelope's `setupKey` (Task 1); `SetupCheckProperties` (Task 2).
- Produces: `SetupCheckService.runFor(UUID userId): Optional<CompanionMessageEntity>` and the check-key constants `SetupCheckService.CHECK_MISSING_SLEEP_GOAL = "missing_sleep_goal"` / `CHECK_PLAN_FEASIBILITY = "plan_feasibility"`. Task 4 adds the second check behind the same entry point.

This task is deliverable end to end: the job runs, the check fires, a card lands in the feed.

- [ ] **Step 1: Write the failing test**

Create `SetupCheckServiceIT`, modelled on `InterventionServiceIT` (read it first — it is the closest template for a card-emitting service, including its one-per-day and cooldown cases):

```java
    @Test
    void testRunFor_shouldEmitTheMissingSleepGoalCard_whenNoGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getKind()).isEqualTo(CompanionMessageEntity.KIND_SETUP);
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
    }

    @Test
    void testRunFor_shouldStaySilent_whenTheGoalRowExists() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldNotRepeatTheSameCheck_insideTheReEmitWindow() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(setupCheckService.runFor(owner)).isPresent();
        assertThat(setupCheckService.runFor(owner)).isEmpty(); // same day AND inside 168h
    }
```

The third test pins BOTH gates at once, which is not enough on its own — add a fourth that pins the weekly window specifically by writing a `setup` card dated outside the re-emit window and asserting a new one is emitted. Use `CompanionMessagePopulator`'s raw/`generatedAt`-controlling factory for that (read the populator; if it has no `generatedAt` override, add one following `FlagLogPopulator.raiseAt`'s native-update idiom, and say so in your report).

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && ./mvnw test -Dtest='SetupCheckServiceIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: compile error — `SetupCheckService` does not exist yet.

- [ ] **Step 3: Implement the service**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Setup checks (S3, bd mezo-d58h.3, spec 2026-09-03 §4 setup table) — the user's CONFIGURATION
 * contradicts what coaching needs. Not flags: these read configuration rather than metric series,
 * run on their own daily cron rather than the flag spine, and emit a {@code setup} card that
 * re-emits at most weekly until the configuration stops contradicting them.
 *
 * <p>PURE CODE, like {@code InterventionService}: the text is config, never an LLM call, so there
 * is nothing to tag with LlmCallContextHolder.
 *
 * <p>Checks are ordered and first-wins — a user with no sleep goal at all gets the goal card, not
 * a feasibility card computed against a goal that does not exist.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class SetupCheckService {

    public static final String CHECK_MISSING_SLEEP_GOAL = "missing_sleep_goal";
    public static final String EYEBROW = "Mezo · beállítás";

    private static final String MISSING_SLEEP_GOAL_TEXT =
        "Nincs még alvás-célod beállítva, így az alvásról csak találgatni tudok. "
        + "Állítsd be a cél alvásidőt és a horgonyt (ébredés vagy lefekvés) — onnantól "
        + "az alváskárt és a terv-javaslatok a te számaidra szólnak.";

    private final SleepGoalRepository sleepGoalRepository;
    private final CompanionMessageRepository companionMessageRepository;
    private final SetupCheckProperties properties;

    /** The first check that fires for {@code userId} today, or empty when the setup is sound. */
    @Transactional
    public Optional<CompanionMessageEntity> runFor(UUID userId) {
        LocalDate today = LocalDate.now();
        if (companionMessageRepository.findByCreatedByAndMessageDateAndKind(
                userId, today, CompanionMessageEntity.KIND_SETUP).isPresent()) {
            log.info("Setup check skipped for user {}: today's setup card already exists", userId);
            return Optional.empty();
        }
        // Read the REPOSITORY, never SleepGoalService/SleepAnchorResolver: both fall back to a
        // config-default ghost, so the missing-row condition is invisible through them.
        if (sleepGoalRepository.findByCreatedByAndDeletedFalse(userId).isEmpty()) {
            return emit(userId, today, CHECK_MISSING_SLEEP_GOAL, MISSING_SLEEP_GOAL_TEXT);
        }
        return Optional.empty();
    }

    /** Writes the card unless this same check already spoke inside the re-emit window. */
    Optional<CompanionMessageEntity> emit(UUID userId, LocalDate today, String checkKey, String text) {
        if (inReEmitWindow(userId, checkKey)) {
            log.info("Setup check {} skipped for user {}: inside the re-emit window", checkKey, userId);
            return Optional.empty();
        }
        CompanionMessageEntity row = new CompanionMessageEntity();
        row.setCreatedBy(userId);
        row.setMessageDate(today);
        row.setKind(CompanionMessageEntity.KIND_SETUP);
        row.setContent(new CompanionMessageEnvelope(EYEBROW, List.of(text), List.of(), null, checkKey));
        row.setGeneratedAt(Instant.now());
        CompanionMessageEntity saved = companionMessageRepository.saveAndFlush(row);
        log.info("Setup check {} delivered for user {}", checkKey, userId);
        return Optional.of(saved);
    }

    /** The same CHECK must not repeat inside its window — envelope keys of recent setup cards,
     *  filtered in memory (single-user volumes), the InterventionService cooldown idiom. */
    private boolean inReEmitWindow(UUID userId, String checkKey) {
        Instant since = Instant.now().minus(properties.reEmitHours(), ChronoUnit.HOURS);
        return companionMessageRepository
            .findByCreatedByAndKindAndGeneratedAtAfter(userId, CompanionMessageEntity.KIND_SETUP, since)
            .stream()
            .anyMatch(row -> checkKey.equals(row.getContent().setupKey()));
    }
}
```

- [ ] **Step 4: Implement the job**

Read `FlagSweepJob` first for the per-user try/catch + switch-gate idiom and the "how do I get the user list" answer (it uses a fan-out helper — use the SAME one, do not invent a user query), then:

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily setup-check pass (S3, bd mezo-d58h.3). Setup checks are about CONFIGURATION, which no
 * write event announces — there is no on-write trigger to hang them on, so a cron is the whole
 * delivery mechanism (unlike flags, which have a listener AND a sweep).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class SetupCheckJob {

    private final SetupCheckService setupCheckService;

    @Scheduled(cron = "${mezo.proactive.setup-checks.cron}")
    public void run() {
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                // SetupCheckService already logs which check spoke (or why it stayed quiet).
                setupCheckService.runFor(user.getId());
            } catch (Exception e) {
                log.warn("Setup check failed for user {}", user.getId(), e);
            }
        }
    }
}
```

with these two fields and the matching imports (`io.mrkuhne.mezo.feature.auth.entity.AppUserEntity`, `io.mrkuhne.mezo.feature.auth.repository.AppUserRepository`):

```java
    private final AppUserRepository appUserRepository;
    private final SetupCheckService setupCheckService;
```

This is `FlagSweepJob`'s per-user-isolation idiom verbatim — one user's bad configuration must never stop the pass. Note `FlagSweepJob` carries a second switch (`FLAG_SWEEP_JOB_SWITCH`) beside the feature switch; check whether `FeaturesConfiguration` has an analogous per-job constant you should add for this job, and if you add one, add its yaml key too and report it.

- [ ] **Step 5: Write the switch-off test**

Create `SetupCheckJobSwitchOffIT` modelled on `FlagSweepJobSwitchOffIT` — asserting the bean is absent when the switch is off. Read that file and mirror it.

- [ ] **Step 6: Run to verify green**

```bash
cd backend && ./mvnw test -Dtest='SetupCheckServiceIT,SetupCheckJobSwitchOffIT,SetupCheckPropertiesIT,InterventionServiceIT,ProactiveApiFeedIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS, including the pre-existing proactive ITs. **Watch for feed tests that assert an exact card set** — a `setup` card may now appear for fixtures whose users have no sleep goal. Widen only exact-set assertions, never weaken one that was checking something else, and report each.

- [ ] **Step 7: Commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src docs/CODEMAP.md
git commit -m "feat(proactive): setup-check service + daily job + missing-sleep-goal card (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 4: The plan-feasibility check

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/PlanFeasibilityCalculator.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/SetupCheckService.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/PlanFeasibilityIT.java`

**Interfaces:**
- Consumes: `SetupCheckProperties.PlanFeasibility` (Task 2); `SetupCheckService.emit(...)` and `CHECK_PLAN_FEASIBILITY` (Task 3).
- Produces: `PlanFeasibilityCalculator.Verdict` — `record Verdict(boolean feasible, LocalTime requiredLightsOut, LocalTime latestConstraint, String constraintSource, int misfitMin, Integer bindingDay)`; `constraintSource` is `"sport"` or `"bedtime"`, naming which half of the check bound the verdict so the card text can say it. `bindingDay` (0=Monday..6=Sunday, added in S3's day-pairing correction, same bd id) is the weekday of the sport slot that binds when `constraintSource` is `"sport"`, and `null` for `"bedtime"` (a nightly habit is not tied to one day) — the card uses it to name the actual evening instead of asserting an unattributed figure.

**The arithmetic, stated once so it is not re-derived per reader.** (Corrected in S3's
whole-branch review, owner decision, same bd id — the original day-agnostic pairing below is
what actually shipped for a few commits, but it is WRONG: see the day-pairing note that follows.)

- `earliestMorningObligation(day)` = the earliest `gym_schedule_slot.time` at or before `morningCutoffHour` **on that specific weekday** (0=Monday..6=Sunday, matching `GymScheduleSlotEntity.dayOfWeek`/`SportScheduleSlotEntity.dayOfWeek` — NOT `DayOfWeek.getValue()`). If that weekday has no morning gym slot, fall back to the sleep goal's `anchorTime` **only when `anchor == "WAKE"`** (a wake anchor is a daily commitment, so it applies to every following morning); when the goal is BED-anchored and that weekday has no morning slot, there is no obligation to be early for on that morning.
- **Sport half — day-paired.** For each `sport_schedule_slot` on weekday `D`: its end = `time + durationMin + commuteBufferMin`; the morning obligation that constrains it is `earliestMorningObligation((D + 1) mod 7)` — the morning that ACTUALLY follows it, not the earliest morning anywhere in the week. If `(D + 1) mod 7` has no obligation (BED-anchored goal, no gym slot that day), the slot is **skipped** — nothing follows it, so it cannot make the plan infeasible. `requiredLightsOut(D) = earliestMorningObligation(D+1) − wakeBufferMin − targetMinutes`; `misfit(D) = end(D) − requiredLightsOut(D)`. The sport half's verdict is the slot with the LARGEST `misfit(D)`; that slot's weekday is what binds (carried as `Verdict.bindingDay`).
- **Bedtime half — deliberately NOT day-paired.** The observed median bedtime is a nightly habit, not tied to one weekday, so it is judged against the week's TIGHTEST morning: `requiredLightsOut = earliestMorningObligation` computed day-agnostically across the whole week (the same day-agnostic scan the original design used for everything) `− wakeBufferMin − targetMinutes`. `observedMedianBedtime` = median of `MetricSeriesService.series(userId, MetricKey.BEDTIME_HOUR, from, to)` values over `bedtimeWindowDays` ending today. **These values are already midnight-shifted** (the extractor adds 24 to clock hours below 12, so 00:30 reads as 24.5) — take the median of the shifted numbers directly and convert back only for display. Fewer than `minBedtimeSamples` values ⇒ this half stays silent, but the sport half can still bind.
- **Combining.** The plan is **infeasible** when the larger of the two halves' misfits exceeds `misfitToleranceMin`. Record which half won in `constraintSource`; record its weekday in `Verdict.bindingDay` for the sport case (null for bedtime). The overall check still stays silent when there is no morning obligation ANYWHERE in the week (day-agnostic gate, unchanged), or when neither half has anything to say (now also true when every sport slot's following day lacks an obligation).
- Every comparison happens on minutes-from-midnight with the same +24h shift applied to any time before noon, so a 00:30 bedtime is later than a 23:00 lights-out rather than 22.5 hours earlier. Do the shift in ONE helper and use it for every operand.

**Day-pairing note:** the spec's original row 6 text (and this plan's original arithmetic block)
stated the rule day-agnostically — "the LATEST across the schedule" vs. "the earliest morning
obligation" — which the first S3 implementation faithfully built. On the owner's real schedule
(Mon–Fri 07:00 gym; volleyball Friday and Saturday evenings) that measured a Friday 21:00
volleyball slot against MONDAY's 07:00 gym slot, asserting a conflict that does not exist. Found
and corrected in S3's whole-branch review; the arithmetic above is what actually shipped.

- [ ] **Step 1: Write the failing tests**

Create `PlanFeasibilityIT`, following `SetupCheckServiceIT`'s fixture style. **Day-pairing
correction (S3 whole-branch review, same bd id):** the fixtures below are what actually shipped —
they differ from an earlier draft of this plan because most gym/sport weekday combinations need a
REAL gym slot on the sport slot's OWN following day (`(D + 1) mod 7`) for the arithmetic to
exercise the intended morning, not the WAKE goal's own anchor-time fallback (which now applies to
every day lacking a gym slot, not just the day the fallback used to be scoped to).

```java
    @Test
    void testRunFor_shouldEmitTheFeasibilityCard_whenEveningSportEndsTooLateForTheMorningSlot() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);   // 8h target (the goal's own wake)
        trainPopulator.createGymSlot(owner, 1, "07:00");            // Tuesday 07:00 — pairs with Monday's sport slot
        trainPopulator.createGymSlot(owner, 4, "07:00");            // Friday 07:00 — pairs with Thursday's sport slot
        // Each real gym morning gives required lights-out = 07:00 − 45' wake buffer − 8h target =
        // 22:15 the evening before — day-paired, so only the evening immediately preceding a given
        // morning is compared against it.
        trainPopulator.createScheduleSlot(owner, 0, "20:00", 120, "training"); // Mon ends 22:00, +30' = 22:30
        // Monday's following day is Tuesday (a real gym morning): 22:30 − 22:15 = 15' — inside the
        // 45' tolerance, so this slot alone must NOT fire.
        trainPopulator.createScheduleSlot(owner, 3, "21:00", 120, "training"); // Thu ends 23:00, +30' = 23:30
        // Thursday's following day is Friday (a real gym morning): 23:30 − 22:15 = 75' > 45' ⇒
        // infeasible, and THIS slot is what binds — a genuine day-paired misfit, not a comparison
        // across unrelated days.

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }

    @Test
    void testRunFor_shouldStaySilent_whenThereIsNoMorningObligationAndTheGoalIsBedAnchored() {
        // No morning gym slot ANYWHERE in the week and a BED-anchored goal ⇒ nothing to be early
        // FOR at all — the global gate (day-agnostic by design) never opens. Inventing an
        // obligation here would be exactly the estimate spec §7 forbids.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "BED", "23:00", 15);
        trainPopulator.createScheduleSlot(owner, 2, "20:30", 120, "training");

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldPreferTheMissingGoalCard_whenThereIsNoGoalAtAll() {
        // Check ordering: no goal ⇒ the goal card, never a feasibility verdict computed against
        // a goal that does not exist.
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createGymSlot(owner, 0, "07:00");
        trainPopulator.createScheduleSlot(owner, 2, "21:00", 120, "training");

        assertThat(setupCheckService.runFor(owner).orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
    }
```

Add, at minimum: the observed-bedtime half binding on its own (`SleepLogPopulator.createTrackerSleepLog(...)`, since the plain `createSleepLog` leaves `bedtime` null; `sleep_log.date` is the WAKE morning); a case where the sport slot's OWN following day has no morning obligation and the goal is BED-anchored (silently skipped — the exact bug this correction fixes); the Sunday→Monday `(D + 1) mod 7` wrap; and the bedtime half still binding against the tightest morning when no sport slot pairs with anything at all. See the shipped `PlanFeasibilityIT` for the full, final set (11 tests).

- [ ] **Step 2: Run to verify they fail**

```bash
cd backend && ./mvnw test -Dtest='PlanFeasibilityIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: the first test fails (no feasibility check exists, so `runFor` returns empty for a user who HAS a goal).

- [ ] **Step 3: Implement the calculator**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.proactive.config.SetupCheckProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Does the user's sleep plan actually fit their own week? (S3, bd mezo-d58h.3, spec §4 setup
 * table row 6; day-pairing corrected in S3's whole-branch review, same bd id.) Required
 * lights-out is derived from the earliest MORNING obligation; the evening schedule and the
 * observed bedtime are what push against it.
 *
 * <p><b>The sport half is day-paired.</b> A sport evening only constrains the morning that
 * ACTUALLY follows it — a Friday-night volleyball match has nothing to do with Monday's early gym
 * slot. So each {@code sport_schedule_slot} on weekday {@code D} is measured against the morning
 * obligation on weekday {@code (D + 1) mod 7}; a slot whose following day has no obligation at
 * all is skipped (nothing follows it, so it cannot make the plan infeasible), never compared
 * against some other day's obligation.
 *
 * <p><b>The bedtime half is deliberately NOT day-paired</b> — this is asymmetric with the sport
 * half ON PURPOSE, not an oversight. The observed median bedtime is a HABIT: it happens every
 * night, not on one weekday, so it must be judged against the user's TIGHTEST morning across the
 * whole week (the earliest morning obligation, day-agnostic), exactly as before this correction.
 *
 * <p>Every operand is minutes-from-midnight with hours below 12 shifted by +24h, so a 00:30
 * bedtime is LATER than a 22:15 lights-out rather than 21h45m earlier. {@code BEDTIME_HOUR}'s
 * extractor already applies that same shift to its values, so its numbers drop straight in.
 *
 * <p>Silent by design (spec §7 — never estimate) when there is no goal, when nothing makes the
 * morning early, or when neither half has enough to say (now including: every sport slot's
 * following day has no morning obligation at all).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class PlanFeasibilityCalculator {

    public static final String SOURCE_SPORT = "sport";
    public static final String SOURCE_BEDTIME = "bedtime";

    private static final int DAY_MINUTES = 1440;
    private static final int NOON_HOUR = 12;
    private static final int DAYS_PER_WEEK = 7;

    private final SleepGoalRepository sleepGoalRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final SportScheduleSlotRepository sportScheduleSlotRepository;
    private final MetricSeriesService metricSeriesService;
    private final SetupCheckProperties properties;

    /** The verdict, or empty when the check must stay silent. */
    public Optional<Verdict> evaluate(UUID userId, LocalDate today) {
        SetupCheckProperties.PlanFeasibility cfg = properties.planFeasibility();
        Optional<SleepGoalEntity> goalOpt = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId);
        if (goalOpt.isEmpty()) {
            return Optional.empty(); // the missing-goal check owns this story
        }
        SleepGoalEntity goal = goalOpt.get();
        List<GymScheduleSlotEntity> gymSlots =
            gymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId);

        // The day-agnostic "tightest morning of the week" — gates the whole check, and is what
        // the (deliberately un-paired) bedtime half is judged against.
        OptionalInt tightestMorning = earliestMorningObligation(gymSlots, goal, cfg);
        if (tightestMorning.isEmpty()) {
            return Optional.empty(); // nothing to be early FOR — inventing one would be an estimate
        }
        int bedtimeRequiredLightsOut =
            tightestMorning.getAsInt() - cfg.wakeBufferMin() - goal.getTargetMinutes();

        Optional<Candidate> sportCandidate = worstSportCandidate(userId, gymSlots, goal, cfg);
        OptionalInt medianBedtime = medianBedtime(userId, today, cfg);
        Optional<Candidate> bedtimeCandidate = medianBedtime.stream()
            .mapToObj(bedtime -> new Candidate(
                bedtime - bedtimeRequiredLightsOut, bedtime, bedtimeRequiredLightsOut, null))
            .findFirst();

        if (sportCandidate.isEmpty() && bedtimeCandidate.isEmpty()) {
            return Optional.empty(); // neither half has anything to say
        }
        boolean sportWins = sportCandidate.isPresent()
            && (bedtimeCandidate.isEmpty() || sportCandidate.get().misfit() >= bedtimeCandidate.get().misfit());
        Candidate winner = sportWins ? sportCandidate.get() : bedtimeCandidate.get();
        String source = sportWins ? SOURCE_SPORT : SOURCE_BEDTIME;

        return Optional.of(new Verdict(winner.misfit() <= cfg.misfitToleranceMin(),
            toLocalTime(winner.requiredLightsOut()), toLocalTime(winner.latestConstraint()),
            source, winner.misfit(), winner.bindingDay()));
    }

    /**
     * The sport slot whose day-paired misfit is largest, or empty when no sport slot has a
     * following-morning obligation at all (skipped, not compared against an unrelated day).
     */
    private Optional<Candidate> worstSportCandidate(UUID userId, List<GymScheduleSlotEntity> gymSlots,
            SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        return sportScheduleSlotRepository
            .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .flatMap(slot -> parseClock(slot.getTime()).stream()
                .flatMap(t -> {
                    int end = shiftedMinutes(t) + slot.getDurationMin() + cfg.commuteBufferMin();
                    int followingDay = Math.floorMod(slot.getDayOfWeek() + 1, DAYS_PER_WEEK);
                    return morningObligationForDay(gymSlots, followingDay, goal, cfg).stream()
                        .mapToObj(obligation -> {
                            int requiredLightsOut =
                                obligation - cfg.wakeBufferMin() - goal.getTargetMinutes();
                            return new Candidate(
                                end - requiredLightsOut, end, requiredLightsOut, slot.getDayOfWeek());
                        });
                }))
            .max(Comparator.comparingInt(Candidate::misfit));
    }

    /** The earliest MORNING gym slot across the WHOLE week, day-agnostic; failing that, a
     *  WAKE-anchored goal's own wake time. Used for the top-level silence gate and for the
     *  (deliberately un-paired) bedtime half — see the class javadoc. */
    private OptionalInt earliestMorningObligation(List<GymScheduleSlotEntity> gymSlots,
            SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        OptionalInt slot = earliestQualifyingSlot(gymSlots.stream(), cfg);
        return slot.isPresent() ? slot : wakeFallback(goal);
    }

    /** The earliest MORNING gym slot on exactly weekday {@code day}; failing that, a
     *  WAKE-anchored goal's own wake time (a wake anchor is a daily commitment, so it applies to
     *  every following morning, not just days with a logged slot). */
    private OptionalInt morningObligationForDay(List<GymScheduleSlotEntity> gymSlots, int day,
            SleepGoalEntity goal, SetupCheckProperties.PlanFeasibility cfg) {
        OptionalInt slot = earliestQualifyingSlot(
            gymSlots.stream().filter(g -> g.getDayOfWeek() == day), cfg);
        return slot.isPresent() ? slot : wakeFallback(goal);
    }

    /** The earliest MORNING slot (at or before {@code morningCutoffHour}) in {@code slots},
     *  malformed rows silently dropped (see {@link #parseClock}). */
    private static OptionalInt earliestQualifyingSlot(
            Stream<GymScheduleSlotEntity> slots, SetupCheckProperties.PlanFeasibility cfg) {
        return slots
            .map(GymScheduleSlotEntity::getTime)
            .flatMap(clock -> parseClock(clock).stream())
            .filter(t -> t.getHour() <= cfg.morningCutoffHour())
            .mapToInt(PlanFeasibilityCalculator::shiftedMinutes)
            .min();
    }

    /** A BED-anchored goal states when to go to bed, not what to be up FOR — no obligation. */
    private static OptionalInt wakeFallback(SleepGoalEntity goal) {
        return "WAKE".equals(goal.getAnchor())
            ? parseClock(goal.getAnchorTime()).map(PlanFeasibilityCalculator::shiftedMinutes)
                .map(OptionalInt::of).orElseGet(OptionalInt::empty)
            : OptionalInt.empty();
    }

    /** {@link LocalTime#parse} on a free-form clock string, returning empty instead of throwing
     *  on malformed input (e.g. {@code "99:99"}, which the varchar(5) column contract admits) —
     *  the {@code MetricSeriesService.clockHour} null-on-malformed idiom, so one bad slot cannot
     *  kill the whole check for a user with an otherwise-fine schedule. */
    private static Optional<LocalTime> parseClock(String clock) {
        if (clock == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(LocalTime.parse(clock));
        } catch (DateTimeParseException e) {
            return Optional.empty();
        }
    }

    /** Median of the logged bedtimes, honest-gated on sample count. */
    private OptionalInt medianBedtime(
            UUID userId, LocalDate today, SetupCheckProperties.PlanFeasibility cfg) {
        LocalDate from = today.minusDays(cfg.bedtimeWindowDays() - 1L);
        // The series values are ALREADY midnight-shifted hours (00:30 reads as 24.5).
        List<Double> hours = new ArrayList<>(
            metricSeriesService.series(userId, MetricKey.BEDTIME_HOUR, from, today).values());
        if (hours.size() < cfg.minBedtimeSamples()) {
            return OptionalInt.empty();
        }
        Collections.sort(hours);
        int mid = hours.size() / 2;
        double median = hours.size() % 2 == 1
            ? hours.get(mid)
            : (hours.get(mid - 1) + hours.get(mid)) / 2;
        return OptionalInt.of((int) Math.round(median * 60));
    }

    /** Minutes from midnight, with anything before noon pushed into the following day. */
    private static int shiftedMinutes(LocalTime time) {
        int minutes = time.getHour() * 60 + time.getMinute();
        return time.getHour() < NOON_HOUR ? minutes + DAY_MINUTES : minutes;
    }

    private static LocalTime toLocalTime(int shiftedMinutes) {
        return LocalTime.ofSecondOfDay(Math.floorMod(shiftedMinutes, DAY_MINUTES) * 60L);
    }

    /** One half's candidate constraint: {@code misfit} decides which half (and, for sport, which
     *  day's slot) wins; {@code bindingDay} is null for the day-agnostic bedtime half. */
    private record Candidate(int misfit, int latestConstraint, int requiredLightsOut, Integer bindingDay) {
    }

    /**
     * @param feasible whether {@code latestConstraint} is within tolerance of {@code requiredLightsOut}
     * @param requiredLightsOut the lights-out time the winning half's morning obligation demands
     *                          (day-paired for {@code sport}, the week's tightest morning for
     *                          {@code bedtime})
     * @param latestConstraint the winning half's own latest time — the day-paired sport slot's end,
     *                         or the observed median bedtime — whichever one {@code constraintSource}
     *                         names
     * @param constraintSource {@link #SOURCE_SPORT} or {@link #SOURCE_BEDTIME} — which half bound
     *                         the verdict, so the card can say it
     * @param misfitMin {@code latestConstraint − requiredLightsOut} in minutes; negative when
     *                  comfortably feasible (a margin, not a shortfall), positive when the plan
     *                  runs late — a card is emitted only once this exceeds the tolerance
     * @param bindingDay the weekday (0=Monday..6=Sunday) of the sport slot that binds when
     *                   {@code constraintSource} is {@code sport}; null for {@code bedtime} — the
     *                   observed bedtime is a nightly habit, not tied to one day
     */
    public record Verdict(boolean feasible, LocalTime requiredLightsOut, LocalTime latestConstraint,
                          String constraintSource, int misfitMin, Integer bindingDay) {
    }
}
```

Note `shiftedMinutes` treats a morning gym slot (07:00) as 1860 and an evening sport end (23:30) as 1410 — both in the same "evening-then-next-morning" frame, which is what makes `end - requiredLightsOut` meaningful. Verify that frame holds for every operand you add. The day-pairing correction (S3 whole-branch review, same bd id) is folded in here directly — `worstSportCandidate` measures each sport slot against `earliestMorningObligation(gymSlots, (D + 1) mod 7, ...)`, not the day-agnostic scan, while `medianBedtime`'s comparison stays keyed off the day-agnostic `tightestMorning`.

- [ ] **Step 4: Wire it into `SetupCheckService`**

Inject `PlanFeasibilityCalculator` and add, after the missing-goal branch and before the final `return Optional.empty()`:

```java
        return planFeasibilityCalculator.evaluate(userId, today)
            .filter(verdict -> !verdict.feasible())
            .flatMap(verdict -> emit(userId, today, CHECK_PLAN_FEASIBILITY, feasibilityText(verdict)));
```

plus `CHECK_PLAN_FEASIBILITY` and a private `feasibilityText(Verdict)` composing the Hungarian card text from the verdict's numbers — it must name the required lights-out, what actually binds (`constraintSource`), the misfit in minutes, and the spec's two suggestions (a later wake target OR shorter/fewer evening sessions). Keep it config-free prose built from the verdict; no LLM call. **Day-pairing correction (S3 whole-branch review, same bd id):** `feasibilityText` also carries a `WEEKDAY_ADJECTIVES` list (0=Monday..6=Sunday, `"hétfői".."vasárnapi"`) and, for the sport source, inserts `WEEKDAY_ADJECTIVES.get(verdict.bindingDay())` before "esti sportod" — the card names the actual evening ("a pénteki esti sportod...") instead of asserting an unattributed figure.

- [ ] **Step 5: Run to verify green**

```bash
cd backend && ./mvnw test -Dtest='PlanFeasibilityIT,SetupCheckServiceIT,SetupCheckJobSwitchOffIT,InterventionServiceIT,ProactiveApiFeedIT' -q -Dmezo.test.use-testcontainers=true
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
node scripts/gen-codemap.mjs
git add backend/src docs/CODEMAP.md
git commit -m "feat(proactive): plan-feasibility setup check — lights-out vs evening schedule (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

---

### Task 5: Docs, gates, ship

**Files:**
- Modify: `docs/CODEMAP.md` (regenerated)
- Modify: `docs/features/proactive.md` — a setup-checks subsection (the two checks, the `setup` kind, the weekly re-emit cadence, the `mezo.proactive.setup-checks.*` config table) and the note that `setup` is the second config-text kind after `intervention`.
- Modify: `docs/features/companion.md` — only if it enumerates the `companion_message` kinds; if it does, the count is now eight.

- [ ] **Step 1: Regenerate and lint**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs --errors-only
```

`--errors-only` is CI's actual gate; the plain form reports pre-existing staleness in unrelated docs. If a file YOU touched appears, fix it.

- [ ] **Step 2: Write the docs** per the file list above, following each file's existing structure and citing bd `mezo-d58h.3`. Record explicitly: the `SleepGoalService`/`SleepAnchorResolver` ghosting trap and why check 4 reads the repository directly; that "earliest morning obligation" resolves to a morning gym slot with the WAKE anchor as fallback; and that a BED-anchored goal with no morning slot makes the feasibility check silent by design. Add no new sections.

- [ ] **Step 3: Focused verification sweep**

```bash
cd backend && ./mvnw test -Dtest='SetupCheck*IT,PlanFeasibilityIT,InterventionServiceIT,ProactiveApiFeedIT,CompanionMessage*IT,FlagEvaluator*IT' -q -Dmezo.test.use-testcontainers=true
cd ../frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

Both frontend modes are required — `VITE_USE_MOCK` unset means MOCK, so a bare `pnpm test` runs mock twice and the real-mode gate would be vacuous.

- [ ] **Step 4: Commit docs**

```bash
git add docs/
git commit -m "docs(proactive): setup checks — kind, cadence and the sleep-goal ghosting trap (<BD-ID>)

Co-Authored-By: <acting model> <noreply@anthropic.com>"
```

- [ ] **Step 5: Ship via the house flow** — invoke `superpowers:finishing-a-development-branch`: push `feat/proactive-coaching-s3`, open a self-PR against `main`, wait for CI green, merge `--no-ff`, push, `bd close <BD-ID>`, `bd dolt push`.

**Merge the latest `main` into the branch BEFORE opening the PR** — a CONFLICTING PR runs ZERO checks on GitHub. Expect a conflict in `1.0.0_master.yml` if another slice added a changeset; resolve by keeping both, then regenerate CODEMAP on top of the merge.

**In a worktree, `git checkout main` fails** (main is checked out in the primary repo). Do the merge on a temporary branch: `git checkout -b tmp-merge-s3 origin/main && git merge --no-ff feat/proactive-coaching-s3 && git push origin tmp-merge-s3:main`.

PR body ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```
