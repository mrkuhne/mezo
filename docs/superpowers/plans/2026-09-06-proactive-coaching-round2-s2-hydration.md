# Proactive Coaching Round 2 · S2 — Training-Day Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship spec item (12) — on a **training day**, when the logged water is under **60 % of the pro-rated** daily target and the user has already logged *something* today, the midday and evening window prompts receive a hydration **fact block**, and a new **~15:00 checkpoint** emits one short, deterministic companion-feed message; on every other day, and on any day with too little evidence, nothing is said at all.

**Architecture:** Slice S2 of [`docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md`](../specs/2026-09-05-proactive-coaching-round2-design.md) §b / §(12). One new deterministic probe (`HydrationShortfallProbe`, the `LogFreshnessProbe` idiom) that answers "is there a shortfall right now, and by how much"; one package-private fact block on `CompanionMessageGenerator` (the `missedWorkoutsBlock` idiom) appended to the window payload; one new `hydration` feed kind written by a **config-text, LLM-free** generator method; one new cron on the existing `CompanionMessageJob`. **No flag, no advice card, no day gate, no mutation, no new endpoint.**

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, JUnit ITs extending `AbstractIntegrationTest`. **Frontend: exactly one line** (the `FeedMessageKind` union) — the feed renderer is kind-agnostic.

**Driving issue:** `mezo-d58h.7.2` (child of `mezo-d58h.7`). Branch: `feat/proactive-round2-s2-hydration` (already cut from `origin/main`).

---

## The three things that make this slice dangerous

**1. `FeedMessageResponse.KindEnum` is GENERATED from the OpenAPI enum.** `ProactiveMapper.map(String kind)` calls `FeedMessageResponse.KindEnum.fromValue(kind)`. Persist a `hydration` row without adding `hydration` to the `enum:` list in `api/feature/proactive/proactive.yml`, and **every** `GET /api/proactive/feed` for that day throws — not just the new message. The DB `CHECK` (`ck_companion_message_kind`) is the second mirror and fails at insert time. Task 2 does both at once, and Task 6's IT reads the row back **through `ProactiveFeedService`** precisely to prove the enum mirror.

**2. `LocalTime.now()` inside a generator is a flaky-test factory.** The whole rule is "what fraction of the waking day has elapsed". A CI run at 04:00 would put the clock before the wake anchor and silently turn every assertion into "no shortfall". Therefore **every** time-dependent method takes an explicit `LocalTime now` parameter; only the public cron entry points call `LocalTime.now()`. ITs always call the explicit overload.

**3. `companion` must not import `proactive`.** The spec's "branches off the existing hourly sweep" cannot be taken literally: `FlagSweepJob` lives in `feature.companion`, `CompanionMessageGenerator` in `feature.proactive`, and `proactive → companion` already exists in bulk. Calling the generator from the sweep would close a **new** feature-slice cycle, which `ArchitectureTest.feature_slices_are_cycle_free` rejects (its freeze store holds exactly one cycle, `biometrics ↔ goal` — nothing else is grandfathered). See the decision below.

---

## Decisions already made — do not re-litigate

- **The checkpoint is a 4th cron on the EXISTING `CompanionMessageJob`, not a branch of the flag sweep.** Same class, same `COMPANION + PROACTIVE + FEED_JOB` switch triple, same per-user isolation, one new `mezo.proactive.hydration.checkpoint-cron` (`0 0 15 * * *`). This honours the spec's actual constraints — no new job class, nothing added to the dawn cluster — without a port inversion whose only purpose would be to dodge a cron line. Record the reasoning in the method's javadoc.
- **The checkpoint message is DETERMINISTIC config text, never an LLM call.** It is three numbers and one sentence; an LLM call here would mean a fake-LLM marker + sentinel mirror in `FakeCompanionLlm`, a `ProseNumberGuard` surface, and a paid call on an hourly-shaped job — all for a line that must never vary in tone. The `intervention`/`setup` kinds are the in-house precedent for config-text feed rows. The template lives in `application.yml`, like the intervention library's texts.
- **The midday/evening FACT is a payload block, not a prompt rewrite.** `hydrationBlock` is appended to `generateWindow`'s payload exactly as `missedWorkoutsBlock` is appended to the morning's, and it carries its own instruction line ("one factual sentence, no imperative"). `WINDOW_PROMPT` gains one rule line and keeps its `WINDOW_MARKER` prefix, so no fake-LLM wiring changes.
- **Training day = planned gym slot today, OR a completed instance today, OR `COMBINED_LOAD_MIN > 0` today.** The planned-slot arm is load-bearing: hydration matters *before* the session, and a metric-only test would keep the companion silent all morning on exactly the day it should speak. `COMBINED_LOAD_MIN` covers sport/running that was actually logged.
- **The water target is per-user: `DietPreferencesPort.resolve(userId).waterMl()`.** Water is never goal-prescribed (`NutritionTargetsProperties`' own javadoc) — it always comes from diet settings, with the config ghost as fallback. Depend on the **port** (`feature.goal.engine.service.DietPreferencesPort`), not on `nutrition`'s concrete `DietPreferencesResolver` (ADR 0012).
- **The waking day comes from `SleepAnchorPort.resolve(userId)`** (wake/bed `LocalTime`, config-ghost when no goal row — never empty), not from a config window. A bed time at or before the wake time means past midnight: add 24 h before computing the fraction.
- **No push.** Feed only, exactly like the round-1 advice card's `feed` channel. A supplement-grade nudge never escalates to a notification.
- **No lazy GET miss-recovery.** `ensureTodayCronKinds` is deliberately NOT extended: a checkpoint recovered at 22:00 would nag about a day that is over, and a plain `GET` must never manufacture one. A missed 15:00 run is simply silence.
- **`hydration` does NOT join `FeedbackLearningService`'s learned-kind list.** That list learns from LLM-written kinds; there is no prose here to learn from. Leave the list untouched.

---

## Global Constraints

- **Silence is the default.** Not a training day, no anchor-elapsed time, target unresolvable, nothing logged today, or water already at/above the threshold ⇒ `Optional.empty()` / `null` / `""`. Every gate gets its own test.
- **Unlogged ≠ non-compliant.** The batch-logger guard is mandatory: with **zero** logs of any kind today (water included), the day is unobserved, not dry — say nothing. `LogFreshnessProbe.anyLoggedAfter(userId, date, date, startOfDay)` is the shared "has anything landed today" read; a water log alone also counts (the probe does not cover `water_log`, so OR it in explicitly).
- **Every threshold is config** (`ProactiveProperties.Hydration`, Bean-Validation ranges, `application.yml` defaults). No numbers in the probe or the generator.
- **Explicit `LocalTime now` on every time-dependent method** (see danger 2).
- Liquibase changesets are immutable; the new file is timestamped after the newest existing one (`202609051700_mezo-d58h.7.1_flag_key_trace_protocol_lapse.sql`) and registered in `1.0.0/1.0.0_master.yml`. CI's `lint` job runs `node scripts/lint-liquibase.mjs`.
- `companion_message.kind` is `varchar(16)`; `hydration` is 9 characters — it fits.
- ArchUnit (CI): constructor DI only, no class-level `@Transactional`, no `@Value`. New directions used here — `proactive → nutrition`? **no** (the port lives in `goal`), `proactive → goal`, `proactive → train`, `proactive → meal`, `proactive → biometrics.sleep`, `proactive → companion` — the last four already exist. Do not take `proactive → goal` on trust: **run `ArchitectureTest`** in Task 4.
- Backend runs REQUIRE `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a pipeline's. "Tests run: 0", or a `-Dtest` filter matching nothing, is a FAILURE to report, not a pass.
- Run everything from this worktree root; never `cd` to the primary repo. Commit subjects carry `(mezo-d58h.7.2)` plus the `Co-Authored-By:` trailer. Regenerate `docs/CODEMAP.md` in the same change as any new file, and AFTER any docs edit.
- Frontend: the one-line union change must pass **both** `VITE_USE_MOCK` modes plus `pnpm build`.

---

## File Structure

| File | Responsibility |
|---|---|
| `feature/proactive/config/ProactiveProperties.java` (M) | `Hydration` nested record + field |
| `backend/src/main/resources/application.yml` (M) | `mezo.proactive.hydration` block |
| `feature/proactive/entity/CompanionMessageEntity.java` (M) | `KIND_HYDRATION` constant |
| `db/changelog/1.0.0/script/202609061200_mezo-d58h.7.2_companion_message_hydration_kind.sql` (C) + `1.0.0/1.0.0_master.yml` (M) | DB CHECK mirror |
| `api/feature/proactive/proactive.yml` (M) | `KindEnum` mirror (generated DTO) |
| `feature/proactive/service/HydrationShortfallProbe.java` (C) | the whole detection: training day, pro-rated target, batch-logger guard |
| `feature/proactive/service/CompanionMessageGenerator.java` (M) | `hydrationBlock` + window payload append + `generateHydrationCheckpoint` |
| `feature/proactive/service/CompanionMessageJob.java` (M) | the 15:00 cron |
| `frontend/src/data/types.ts` (M) | `FeedMessageKind` union member |
| `feature/proactive/HydrationPropertiesIT.java` (C, test) | config binding |
| `feature/proactive/service/HydrationShortfallProbeIT.java` (C, test) | fire + every silence gate |
| `feature/proactive/service/CompanionMessageHydrationIT.java` (C, test) | fact block, checkpoint row, idempotence, feed round-trip |
| `docs/features/proactive.md`, `docs/CODEMAP.md` (M) | docs |

---

### Task 1: config — `ProactiveProperties.Hydration` + `application.yml`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.proactive:` block, after `feed:`)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HydrationPropertiesIT.java`

**Interfaces:**
- Produces: `ProactiveProperties.hydration()` → `Hydration(String checkpointCron, int shortfallPct, int minProRatedMl, String checkpointEyebrow, String checkpointTemplate)`

- [ ] **Step 1: Write the failing binding IT** (the `SetupCheckPropertiesIT` shape).

```java
package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S2 (bd mezo-d58h.7.2, spec §12): the training-day hydration tuning binds from
 *  {@code mezo.proactive.hydration}. Binding only — the probe itself is exercised in
 *  {@code HydrationShortfallProbeIT}. */
class HydrationPropertiesIT extends AbstractIntegrationTest {

    @Autowired private ProactiveProperties properties;

    @Test
    void testHydrationProperties_shouldBindFromYaml_whenContextStarts() {
        assertThat(properties.hydration().checkpointCron()).isEqualTo("0 0 15 * * *");
        assertThat(properties.hydration().shortfallPct()).isEqualTo(60);
        assertThat(properties.hydration().minProRatedMl()).isEqualTo(500);
        assertThat(properties.hydration().checkpointEyebrow()).isEqualTo("Hidratáció");
        assertThat(properties.hydration().checkpointTemplate()).contains("{logged}", "{prorated}", "{target}");
    }
}
```

- [ ] **Step 2: Run it — expect a compile failure** (`hydration()` does not exist).

```bash
./mvnw -q -pl backend test -Dtest=HydrationPropertiesIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Add the record.** In `ProactiveProperties`, add `@NotNull @Valid Hydration hydration` as the LAST component of the outer record (after `feed`), and the nested record after `Feed`:

```java
    /** Round 2 S2 (bd mezo-d58h.7.2, spec §12) — training-day hydration. Two channels, one
     *  detection: the midday/evening window prompts get a FACT block, and a 15:00 checkpoint
     *  emits a deterministic message when (and only when) the shortfall holds. */
    public record Hydration(
        /** ~15:00 checkpoint schedule (server zone) — you cannot catch up on water at day's end,
         *  so this is the one intraday exception to the "no incomplete-data signals" policy. */
        @NotBlank String checkpointCron,
        /** Fire below this percentage of the PRO-RATED target (spec §12: 60%). */
        @Min(10) @Max(100) int shortfallPct,
        /** Floor on the pro-rated target: right after wake the pro-rated number is a rounding
         *  artefact, and "you are behind on 120 ml" is noise, not a signal. */
        @Min(0) @Max(3000) int minProRatedMl,
        /** Feed eyebrow of the checkpoint row. */
        @NotBlank String checkpointEyebrow,
        /** Checkpoint body template; {logged}/{prorated}/{target} are replaced with millilitres.
         *  Config text, never LLM prose — see the plan's decision list. */
        @NotBlank String checkpointTemplate
    ) {}
```

- [ ] **Step 4: Add the yaml block** under `mezo.proactive:`, immediately after the `feed:` block:

```yaml
    hydration:
      # Round 2 S2 (mezo-d58h.7.2, spec §12): training-day hydration. The 15:00 checkpoint is the
      # ONE intraday signal in round 2 — water cannot be caught up at 22:00 — and it speaks only
      # when the shortfall holds AND the user has already logged something today.
      checkpoint-cron: "0 0 15 * * *"
      # Fire below 60% of the pro-rated (waking-day-fraction) target.
      shortfall-pct: 60
      # Below this pro-rated target there is nothing meaningful to be behind on yet.
      min-pro-rated-ml: 500
      checkpoint-eyebrow: "Hidratáció"
      checkpoint-template: "Edzésnap van, és eddig {logged} ml víz van naplózva — ilyenkorra a mai {target} ml-ből arányosan kb. {prorated} ml jönne ki. Egy pohárral most könnyebb, mint hárommal este."
```

- [ ] **Step 5: Run the IT — expect PASS.**

```bash
./mvnw -q -pl backend test -Dtest=HydrationPropertiesIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/ProactiveProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/proactive/HydrationPropertiesIT.java
git commit -m "$(cat <<'EOF'
feat(proactive): bind training-day hydration tuning (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: the `hydration` kind — entity constant, DB CHECK, OpenAPI enum, FE union

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609061200_mezo-d58h.7.2_companion_message_hydration_kind.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `api/feature/proactive/proactive.yml`
- Modify: `frontend/src/data/types.ts`

**Interfaces:**
- Produces: `CompanionMessageEntity.KIND_HYDRATION` (`"hydration"`), `FeedMessageResponse.KindEnum.HYDRATION`

**Why one task:** these four are mirrors of a single fact. Splitting them ships a state where a persisted row breaks the feed read.

- [ ] **Step 1: Add the entity constant** after `KIND_ADVICE`:

```java
    /** Round 2 S2 (bd mezo-d58h.7.2, spec §12): the ~15:00 training-day hydration checkpoint.
     *  DETERMINISTIC config text (the {@code intervention}/{@code setup} precedent), never LLM
     *  prose, and written ONLY when the pro-rated shortfall holds — so a missing row is the
     *  normal, honest case, not a failure. */
    public static final String KIND_HYDRATION = "hydration";
```

- [ ] **Step 2: Create the changeset** `202609061200_mezo-d58h.7.2_companion_message_hydration_kind.sql`:

```sql
-- Round 2 S2 (mezo-d58h.7.2, spec 2026-09-05 §b/§12): the ~15:00 hydration checkpoint is a
-- companion-feed kind of its own — deterministic config text, emitted only on a training day
-- whose pro-rated water shortfall holds. The (created_by, message_date, kind) partial unique
-- index applies to it like every other kind, so at most one checkpoint per user per day.
ALTER TABLE companion_message DROP CONSTRAINT ck_companion_message_kind;
ALTER TABLE companion_message
    ADD CONSTRAINT ck_companion_message_kind
        CHECK (kind IN ('morning','sleep','weight','midday','evening','intervention','people','setup','advice','hydration'));
```

- [ ] **Step 3: Register it** at the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609061200_mezo-d58h.7.2_companion_message_hydration_kind"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609061200_mezo-d58h.7.2_companion_message_hydration_kind.sql
```

- [ ] **Step 4: Extend the OpenAPI enum** in `api/feature/proactive/proactive.yml`, `FeedMessageResponse.kind` — append `hydration` to the `enum:` list and extend the description:

```yaml
        kind:
          type: string
          description: Feed message kind — morning, sleep, weight, midday, evening, or people LLM-generated messages; advice is the single daily coaching card (S4, mezo-d58h.4) whose prose is LLM-written over deterministic facts; hydration is the round-2 training-day water checkpoint (S2, mezo-d58h.7.2) — deterministic config text, present only on a day whose shortfall held; intervention and setup are the pre-S4 config-text cards, kept for existing rows only.
          enum: [morning, sleep, weight, midday, evening, intervention, people, setup, advice, hydration]
```

- [ ] **Step 5: Extend the FE union** in `frontend/src/data/types.ts` (line ~19):

```ts
export type FeedMessageKind = 'morning' | 'sleep' | 'weight' | 'midday' | 'evening' | 'intervention' | 'people' | 'setup' | 'advice' | 'hydration'
```

- [ ] **Step 6: Verify the generated enum really carries the value.**

```bash
./mvnw -q -pl backend generate-sources && grep -n "HYDRATION" backend/target/generated-sources/openapi/src/main/java/io/mrkuhne/mezo/api/dto/FeedMessageResponse.java
```

Expected: a `HYDRATION("hydration")` constant. No output ⇒ the yml edit did not take — fix before continuing.

- [ ] **Step 7: Liquibase lint + FE typecheck.**

```bash
node scripts/lint-liquibase.mjs && (cd frontend && pnpm exec tsc --noEmit)
```

- [ ] **Step 8: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/entity/CompanionMessageEntity.java backend/src/main/resources/db/changelog api/feature/proactive/proactive.yml frontend/src/data/types.ts
git commit -m "$(cat <<'EOF'
feat(proactive): add the hydration feed kind and its four mirrors (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `HydrationShortfallProbe` — the whole detection

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HydrationShortfallProbe.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/HydrationShortfallProbeIT.java`

**Interfaces:**
- Consumes: `ProactiveProperties.hydration()` (Task 1)
- Produces:
  - `record HydrationShortfallProbe.Shortfall(int loggedMl, int dailyTargetMl, int proRatedTargetMl, int deficitMl)`
  - `Optional<Shortfall> HydrationShortfallProbe.evaluate(UUID userId, LocalDate date, LocalTime now)`

- [ ] **Step 1: Write the failing IT.** Every gate gets a case; the clock is always explicit.

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S2 (bd mezo-d58h.7.2, spec §12). The probe is the WHOLE detection: training day,
 * pro-rated target from the sleep anchor, 60% threshold, batch-logger guard. The clock is always
 * passed explicitly — a {@code LocalTime.now()} inside would make every assertion depend on the
 * hour CI happens to run at.
 *
 * <p>Anchor: {@link SleepGoalPopulator#goal(UUID)} is a 06:45 wake / 23:15 bed pair, so at 15:00
 * the waking day is 8h15m of 16h30m — exactly half elapsed. With the 4000 ml config-ghost target
 * that is a 2000 ml pro-rated target and a 1200 ml (60%) firing line.
 */
class HydrationShortfallProbeIT extends AbstractIntegrationTest {

    private static final LocalTime AT_15 = LocalTime.of(15, 0);

    @Autowired private HydrationShortfallProbe probe;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;

    /** A user with a wake/bed anchor and a gym slot on {@code day}'s weekday. */
    private UUID trainingUser(LocalDate day) {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        trainPopulator.createGymScheduleSlot(owner, day.getDayOfWeek().getValue() - 1, "18:00");
        return owner;
    }

    @Test
    void testEvaluate_shouldReportTheShortfall_whenATrainingDayIsHalfOverAndWaterIsWayBehind() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        HydrationShortfallProbe.Shortfall shortfall = probe.evaluate(owner, day, AT_15).orElseThrow();

        assertThat(shortfall.loggedMl()).isEqualTo(400);
        assertThat(shortfall.dailyTargetMl()).isEqualTo(4000);
        assertThat(shortfall.proRatedTargetMl()).isEqualTo(2000);
        assertThat(shortfall.deficitMl()).isEqualTo(1600);
    }

    @Test
    void testEvaluate_shouldBeSilent_whenTheDayIsNotATrainingDay() {
        LocalDate day = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        waterLogPopulator.createWaterLog(owner, day, 400);

        assertThat(probe.evaluate(owner, day, AT_15)).isEmpty();
    }

    /** The batch-logger guard: nothing at all has been logged today, so the day is UNOBSERVED,
     *  not dry. Zero water + zero everything ⇒ silence (spec §12). */
    @Test
    void testEvaluate_shouldBeSilent_whenNothingHasBeenLoggedTodayAtAll() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);

        assertThat(probe.evaluate(owner, day, AT_15)).isEmpty();
    }

    @Test
    void testEvaluate_shouldBeSilent_whenWaterIsAtOrAboveTheProRatedThreshold() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 1200);

        assertThat(probe.evaluate(owner, day, AT_15)).isEmpty();
    }

    /** Before the wake anchor there is no elapsed waking day to be behind on. */
    @Test
    void testEvaluate_shouldBeSilent_whenTheClockIsBeforeTheWakeAnchor() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 100);

        assertThat(probe.evaluate(owner, day, LocalTime.of(5, 30))).isEmpty();
    }

    /** Just after wake the pro-rated target is a rounding artefact — min-pro-rated-ml suppresses it. */
    @Test
    void testEvaluate_shouldBeSilent_whenTheProRatedTargetIsStillBelowTheFloor() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 50);

        assertThat(probe.evaluate(owner, day, LocalTime.of(7, 30))).isEmpty();
    }
}
```

- [ ] **Step 2: Check the populator seams the IT assumes.**

```bash
grep -n "createGymScheduleSlot" backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java
```

If the method has a different name or signature, adapt the IT (do NOT add a new populator method unless none fits: `TrainPopulator` already owns gym schedule slots).

- [ ] **Step 3: Run it — expect a compile failure** (`HydrationShortfallProbe` does not exist).

```bash
./mvnw -q -pl backend test -Dtest=HydrationShortfallProbeIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 4: Write the probe.**

```java
package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.goal.engine.service.DietPreferencesPort;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Round 2 S2 (bd mezo-d58h.7.2, spec 2026-09-05 §b/§12): "is this user behind on water RIGHT NOW,
 * on a day that asks for water" — the single detection behind both S2 channels (the midday/evening
 * prompt fact and the 15:00 checkpoint). The {@link LogFreshnessProbe} idiom: a deterministic,
 * separately testable read that the generator only renders.
 *
 * <p>Hydration is round 2's ONE intraday exception to the adherence-neutral firing policy (spec
 * §"Decisions"): water cannot be caught up at 22:00. The exception is paid for by three gates —
 * training day only, a pro-rated (not full-day) target, and the batch-logger guard: with nothing
 * at all logged today the day is UNOBSERVED, not dry, and unobserved must stay silent.
 *
 * <p>The clock is a PARAMETER, never {@code LocalTime.now()} — the whole rule is "what fraction of
 * the waking day has elapsed", so an implicit clock would make every test depend on the hour it
 * runs at.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class HydrationShortfallProbe {

    /** All millilitres. {@code deficitMl} is {@code proRatedTargetMl - loggedMl}, always > 0. */
    public record Shortfall(int loggedMl, int dailyTargetMl, int proRatedTargetMl, int deficitMl) {}

    private static final int MINUTES_PER_DAY = 24 * 60;

    private final ProactiveProperties properties;
    private final DietPreferencesPort dietPreferences;
    private final SleepAnchorPort sleepAnchorPort;
    private final WaterLogRepository waterLogRepository;
    private final GymScheduleSlotRepository gymScheduleSlotRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final MetricSeriesService metricSeriesService;
    private final LogFreshnessProbe logFreshnessProbe;

    /** Empty whenever the honest answer is "not enough to say anything" — see the gates inline. */
    @Transactional(readOnly = true)
    public Optional<Shortfall> evaluate(UUID userId, LocalDate date, LocalTime now) {
        ProactiveProperties.Hydration cfg = properties.hydration();
        if (!isTrainingDay(userId, date)) {
            return Optional.empty();
        }
        double elapsed = wakingFractionElapsed(userId, now);
        if (elapsed <= 0) {
            return Optional.empty();
        }
        int dailyTargetMl = dietPreferences.resolve(userId).waterMl();
        int proRatedMl = (int) Math.round(dailyTargetMl * elapsed);
        if (proRatedMl < cfg.minProRatedMl()) {
            return Optional.empty();
        }
        int loggedMl = waterLogRepository.sumAmountForDay(userId, date);
        if (loggedMl >= proRatedMl * cfg.shortfallPct() / 100.0) {
            return Optional.empty();
        }
        // Batch-logger guard (spec §12): zero water AND zero other logs today ⇒ the day is
        // unobserved, not dry. A water log alone also counts as "the user is logging today" —
        // LogFreshnessProbe deliberately does not cover water_log, so it is OR'd in here.
        if (loggedMl == 0 && !logFreshnessProbe.anyLoggedAfter(
                userId, date, date, date.atStartOfDay(ZoneId.systemDefault()).toInstant())) {
            return Optional.empty();
        }
        return Optional.of(new Shortfall(loggedMl, dailyTargetMl, proRatedMl, proRatedMl - loggedMl));
    }

    /** Planned gym slot today, a completed instance today, or any logged combined load today —
     *  the planned arm is load-bearing: hydration matters BEFORE the session, so a metric-only
     *  test would stay silent all morning on exactly the day that needs the signal. */
    private boolean isTrainingDay(UUID userId, LocalDate date) {
        // gym_schedule_slot.day_of_week is 0=Monday..6=Sunday (the entity's own comment).
        int dow = date.getDayOfWeek().getValue() - 1;
        boolean planned = gymScheduleSlotRepository
                .findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
                .map(GymScheduleSlotEntity::getDayOfWeek)
                .anyMatch(d -> d != null && d == dow);
        if (planned) {
            return true;
        }
        if (!workoutSessionRepository.findDoneInstanceDates(userId, date, date).isEmpty()) {
            return true;
        }
        return metricSeriesService.series(userId, MetricKey.COMBINED_LOAD_MIN, date, date)
                .getOrDefault(date, 0.0) > 0;
    }

    /** Fraction of the wake→bed span already elapsed at {@code now}, clamped to 1.0; 0 before wake.
     *  A bed time at or before wake is past midnight — add a day before measuring. */
    private double wakingFractionElapsed(UUID userId, LocalTime now) {
        SleepAnchorPort.SleepAnchor anchor = sleepAnchorPort.resolve(userId);
        int wakeMin = anchor.wake().toSecondOfDay() / 60;
        int bedMin = anchor.bed().toSecondOfDay() / 60;
        if (bedMin <= wakeMin) {
            bedMin += MINUTES_PER_DAY;
        }
        int nowMin = now.toSecondOfDay() / 60;
        if (nowMin <= wakeMin) {
            return 0;
        }
        return Math.min(1.0, (nowMin - wakeMin) / (double) (bedMin - wakeMin));
    }
}
```

- [ ] **Step 5: Run the IT — expect PASS.**

```bash
./mvnw -q -pl backend test -Dtest=HydrationShortfallProbeIT -Dmezo.test.use-testcontainers=true
```

If the "half elapsed" assertion is off by a millilitre or two, fix the ASSERTION to the anchor's real arithmetic — never loosen the probe's rounding to make a number pretty.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/HydrationShortfallProbe.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/HydrationShortfallProbeIT.java
git commit -m "$(cat <<'EOF'
feat(proactive): detect the training-day pro-rated water shortfall (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: ArchUnit gate for the new dependency directions

**Files:** none (verification only)

**Why its own task:** Task 3 introduced `proactive → goal` (the diet-preferences port) and `proactive → biometrics.sleep`'s anchor port. If either closes a cycle, the fix is a consumer-owned port in `proactive` — a design change, not a patch — and it must be discovered now, not after three more tasks are stacked on top.

- [ ] **Step 1: Run the architecture test.**

```bash
./mvnw -q -pl backend test -Dtest=ArchitectureTest -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 2: Expected — PASS.** If `feature_slices_are_cycle_free` fails naming `proactive`, STOP and do NOT extend the freeze store. Replace the offending import with a `proactive`-owned port interface (`NudgeSendPort` is the in-house shape: interface in the consumer, adapter in the provider, `ObjectProvider` when the provider may be switched off) and re-run.

---

### Task 5: the prompt fact — `hydrationBlock` on the window payload

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageHydrationIT.java` (block cases only; Task 6 appends the checkpoint cases)

**Interfaces:**
- Consumes: `HydrationShortfallProbe.evaluate(UUID, LocalDate, LocalTime)` (Task 3)
- Produces: `String CompanionMessageGenerator.hydrationBlock(UUID userId, LocalDate date, LocalTime now)` — package-private, `""` when there is no shortfall

- [ ] **Step 1: Write the failing IT** (the `CompanionMessageMissedWorkoutsIT` shape — assert the block directly, never prompt text through a scripted answer).

```java
package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WaterLogPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S2 (bd mezo-d58h.7.2, spec §12) — the hydration FACT block the midday/evening window
 * payload carries. Lives in the {@code ...proactive.service} package so it can assert the
 * package-private block builder directly (the {@code CompanionMessageMissedWorkoutsIT} precedent).
 */
class CompanionMessageHydrationIT extends AbstractIntegrationTest {

    private static final LocalTime AT_15 = LocalTime.of(15, 0);

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private WaterLogPopulator waterLogPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;

    private UUID trainingUser(LocalDate day) {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        trainPopulator.createGymScheduleSlot(owner, day.getDayOfWeek().getValue() - 1, "18:00");
        return owner;
    }

    @Test
    void testHydrationBlock_shouldCarryTheRealNumbers_whenTheShortfallHolds() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        String block = companionMessageGenerator.hydrationBlock(owner, day, AT_15);

        assertThat(block).contains("HIDRATÁCIÓ").contains("400").contains("2000").contains("4000");
    }

    @Test
    void testHydrationBlock_shouldBeEmpty_whenThereIsNoShortfall() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 3000);

        assertThat(companionMessageGenerator.hydrationBlock(owner, day, AT_15)).isEmpty();
    }

    /** Rest day: the block never appears, however little water was logged. */
    @Test
    void testHydrationBlock_shouldBeEmpty_whenItIsNotATrainingDay() {
        LocalDate day = LocalDate.now();
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner);
        waterLogPopulator.createWaterLog(owner, day, 100);

        assertThat(companionMessageGenerator.hydrationBlock(owner, day, AT_15)).isEmpty();
    }
}
```

- [ ] **Step 2: Run it — expect a compile failure** (`hydrationBlock` does not exist).

```bash
./mvnw -q -pl backend test -Dtest=CompanionMessageHydrationIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Add the field, the block and the payload append.** In `CompanionMessageGenerator`: add `private final HydrationShortfallProbe hydrationShortfallProbe;` to the field block (after `companionFlagLogRepository`), then the block builder next to `missedWorkoutsBlock`:

```java
    /**
     * Round 2 S2 (bd mezo-d58h.7.2, spec §12): the training-day hydration shortfall as a FACT
     * block for the midday/evening window prompt — so the note can mention water while it can
     * still be drunk. Deterministic numbers from {@link HydrationShortfallProbe}; "" when there is
     * no shortfall, which is the normal case. The clock is a parameter for the reason the probe
     * documents. Package-private: the IT asserts it directly rather than reading prompt text back
     * out of a scripted answer.
     */
    String hydrationBlock(UUID userId, LocalDate date, LocalTime now) {
        return hydrationShortfallProbe.evaluate(userId, date, now)
                .map(s -> "\n\nHIDRATÁCIÓ (edzésnap, tény — ne szidj, csak tedd láthatóvá):\n"
                        + "- ma eddig naplózva: " + s.loggedMl() + " ml (napi cél: " + s.dailyTargetMl() + " ml)\n"
                        + "- a nap eddig eltelt részére arányosan kb. " + s.proRatedTargetMl() + " ml jönne ki\n"
                        + "- ha szóba hozod, EGY tárgyilagos mondat legyen, szemrehányás és felszólítás nélkül\n")
                .orElse("");
    }
```

In `generateWindow`, append the block to the payload — after `earlierMessagesBlock`, before the `ABLAK` line:

```java
        String payload = contextSnapshotAssembler.render(userId, date)
                + knowledgeFactService.renderPromptBlock(userId)
                + "\n\nUTOLSÓ NAPI ÖSSZEFOGLALÓ:\n- " + latest.getSummaryDate() + ": " + latest.getNarrative()
                + earlierMessagesBlock(userId, date)
                + hydrationBlock(userId, date, LocalTime.now())
                + "\n\nABLAK: " + window;
```

Add one rule line to `WINDOW_PROMPT` (keep `WINDOW_MARKER` as the prefix — the fake-LLM dispatch depends on it):

```java
            + "- Ha van HIDRATÁCIÓ blokk, legfeljebb EGY tárgyilagos mondatot szánj rá a blokk "
            + "számaival; se szemrehányás, se felszólítás, és más blokk számait ne keverd bele. "
```

Add the `java.time.LocalTime` import.

- [ ] **Step 4: Run the IT — expect PASS.**

```bash
./mvnw -q -pl backend test -Dtest=CompanionMessageHydrationIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 5: Run the window-message regression suite** — the payload changed, so the existing generator ITs must still pass.

```bash
./mvnw -q -pl backend test -Dtest='CompanionMessageGeneratorIT,CompanionMessageMissedWorkoutsIT,CompanionMessagePersistenceIT' -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageHydrationIT.java
git commit -m "$(cat <<'EOF'
feat(proactive): carry the hydration shortfall into the window prompts (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: the 15:00 checkpoint message

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageHydrationIT.java`

**Interfaces:**
- Consumes: `KIND_HYDRATION` (Task 2), `HydrationShortfallProbe` (Task 3)
- Produces:
  - `CompanionMessageEntity generateHydrationCheckpoint(UUID userId, LocalDate date)` (public, cron entry point — uses `LocalTime.now()`)
  - `CompanionMessageEntity generateHydrationCheckpoint(UUID userId, LocalDate date, LocalTime now)` (package-private, the tested one)

- [ ] **Step 1: Append the failing cases** to `CompanionMessageHydrationIT` (add the imports `io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity`, `io.mrkuhne.mezo.feature.proactive.service.ProactiveFeedService` is same-package so needs none, and `io.mrkuhne.mezo.api.dto.FeedMessageResponse`; autowire `@Autowired private ProactiveFeedService proactiveFeedService;`):

```java
    @Test
    void testHydrationCheckpoint_shouldWriteOneDeterministicRow_whenTheShortfallHolds() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        CompanionMessageEntity message =
            companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);

        assertThat(message).isNotNull();
        assertThat(message.getKind()).isEqualTo(CompanionMessageEntity.KIND_HYDRATION);
        assertThat(message.getContent().eyebrow()).isEqualTo("Hidratáció");
        assertThat(message.getContent().body()).hasSize(1);
        assertThat(message.getContent().body().getFirst()).contains("400").contains("2000").contains("4000");
    }

    @Test
    void testHydrationCheckpoint_shouldWriteNothing_whenThereIsNoShortfall() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 3000);

        assertThat(companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15)).isNull();
    }

    /** One checkpoint per user per day: the second call returns the SAME row, never a second one
     *  (the partial unique index would reject it anyway — this is the graceful path). */
    @Test
    void testHydrationCheckpoint_shouldBeIdempotent_whenCalledTwice() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);

        CompanionMessageEntity first =
            companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);
        CompanionMessageEntity second =
            companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);

        assertThat(second.getId()).isEqualTo(first.getId());
    }

    /** The generated {@code FeedMessageResponse.KindEnum} mirror: without 'hydration' in the
     *  OpenAPI enum, this read throws for the WHOLE day, not just for this row. */
    @Test
    void testHydrationCheckpoint_shouldSurviveTheFeedReadPath_whenItExists() {
        LocalDate day = LocalDate.now();
        UUID owner = trainingUser(day);
        waterLogPopulator.createWaterLog(owner, day, 400);
        companionMessageGenerator.generateHydrationCheckpoint(owner, day, AT_15);

        assertThat(proactiveFeedService.getFeed(owner, day))
            .extracting(FeedMessageResponse::getKind)
            .contains(FeedMessageResponse.KindEnum.HYDRATION);
    }
```

- [ ] **Step 2: Run — expect a compile failure** (`generateHydrationCheckpoint` does not exist).

```bash
./mvnw -q -pl backend test -Dtest=CompanionMessageHydrationIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 3: Write the generator method**, placed after `generateWindow`:

```java
    /**
     * Round 2 S2 (bd mezo-d58h.7.2, spec §12): the ~15:00 training-day hydration checkpoint —
     * round 2's ONE intraday signal, because water cannot be caught up at 22:00. Emits a row ONLY
     * when {@link HydrationShortfallProbe} reports a shortfall; no shortfall ⇒ null ⇒ no row, which
     * is the normal case, not a failure.
     *
     * <p><b>Deliberately LLM-free</b> (the {@code intervention}/{@code setup} config-text
     * precedent): the message is three numbers and one sentence, it must never drift in tone, and
     * an hourly-shaped job is the wrong place to spend a model call. The template lives in
     * {@code mezo.proactive.hydration.checkpoint-template}.
     *
     * <p>Idempotent: an existing row for the day is returned untouched — the (created_by,
     * message_date, kind) partial unique index means at most one checkpoint per user per day.
     */
    @Transactional
    public CompanionMessageEntity generateHydrationCheckpoint(UUID userId, LocalDate date) {
        return generateHydrationCheckpoint(userId, date, LocalTime.now());
    }

    /** Clock-explicit variant — the tested one (see {@link HydrationShortfallProbe}'s javadoc). */
    @Transactional
    CompanionMessageEntity generateHydrationCheckpoint(UUID userId, LocalDate date, LocalTime now) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_HYDRATION)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        HydrationShortfallProbe.Shortfall shortfall =
                hydrationShortfallProbe.evaluate(userId, date, now).orElse(null);
        if (shortfall == null) {
            log.debug("No hydration shortfall for {} on {} at {} — no checkpoint message",
                    userId, date, now);
            return null;
        }
        ProactiveProperties.Hydration cfg = properties.hydration();
        String body = cfg.checkpointTemplate()
                .replace("{logged}", String.valueOf(shortfall.loggedMl()))
                .replace("{prorated}", String.valueOf(shortfall.proRatedTargetMl()))
                .replace("{target}", String.valueOf(shortfall.dailyTargetMl()));
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(CompanionMessageEntity.KIND_HYDRATION);
        message.setContent(new CompanionMessageEnvelope(cfg.checkpointEyebrow(), List.of(body), List.of()));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }
```

If `CompanionMessageEnvelope`'s canonical constructor has more than three components (it also carries `interventionKey`/`facts`/`suggestions`/`actions`/`applied` for the card kinds), use the SAME factory or constructor `generateWindow` uses — copy its call shape exactly rather than guessing at nulls.

- [ ] **Step 4: Run the IT — expect PASS.**

```bash
./mvnw -q -pl backend test -Dtest=CompanionMessageHydrationIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageGenerator.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageHydrationIT.java
git commit -m "$(cat <<'EOF'
feat(proactive): emit the 15:00 training-day hydration checkpoint (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: the cron

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageJobIT.java`

**Interfaces:**
- Consumes: `generateHydrationCheckpoint(UUID, LocalDate)` (Task 6), `mezo.proactive.hydration.checkpoint-cron` (Task 1)

- [ ] **Step 1: Read the existing job IT** so the new case matches its house shape (how it drives a run, what it asserts):

```bash
sed -n '1,80p' backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageJobIT.java
```

- [ ] **Step 2: Write the failing case.** Mirror the file's existing style; the assertion is that a run over a shortfall user leaves exactly one `hydration` row, and a run over a rest-day user leaves none. Use the populators from Task 3 (`SleepGoalPopulator`, `TrainPopulator`, `WaterLogPopulator`) and the repository/`ProactiveFeedService` read the file already uses. Note the job calls the **`LocalTime.now()`** entry point, so the assertion must hold at any hour: assert `hydrationRowsFor(restDayUser)` is empty (always true), and for the shortfall user assert **at most one** row and that any row present carries `KIND_HYDRATION` — never "exactly one", which would fail on a CI run before the wake anchor.

- [ ] **Step 3: Run it — expect FAIL** (`runHydrationCheckpoint` does not exist).

```bash
./mvnw -q -pl backend test -Dtest=CompanionMessageJobIT -Dmezo.test.use-testcontainers=true
```

- [ ] **Step 4: Add the scheduled method** after `runEvening()`:

```java
    /**
     * Round 2 S2 (bd mezo-d58h.7.2, spec §12): the ~15:00 training-day hydration checkpoint.
     *
     * <p>The spec sketched this as a branch of the hourly flag sweep, but {@code FlagSweepJob}
     * lives in {@code feature.companion} and the generator in {@code feature.proactive}, where
     * {@code proactive → companion} already exists in bulk — the call would close a NEW feature
     * slice cycle that {@code ArchitectureTest.feature_slices_are_cycle_free} rejects. A 4th cron
     * on THIS job satisfies the spec's real constraints (no new job class, nothing added to the
     * dawn cluster) without a port inversion whose only purpose would be dodging a cron line.
     *
     * <p>Emits nothing on a day without a shortfall — this is not a fixed daily prompt.
     */
    @Scheduled(cron = "${mezo.proactive.hydration.checkpoint-cron}")
    public void runHydrationCheckpoint() {
        LocalDate today = LocalDate.now();
        AtomicInteger generated = new AtomicInteger();
        userFanOut.forEachActiveUser("Companion-feed hydration checkpoint", user -> {
            try {
                if (companionMessageGenerator.generateHydrationCheckpoint(user.getId(), today) != null) {
                    generated.incrementAndGet();
                }
            } catch (Exception e) {
                log.warn("Hydration-checkpoint generation failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Hydration checkpoint run for {}: {} message(s) present", today, generated.get());
    }
```

- [ ] **Step 5: Run the job ITs (including the switch-off one) — expect PASS.**

```bash
./mvnw -q -pl backend test -Dtest='CompanionMessageJobIT,CompanionMessageJobSwitchOffIT' -Dmezo.test.use-testcontainers=true
```

`CompanionMessageJobSwitchOffIT` asserts the job bean is absent when the switches are off — the new method inherits that gate, and the IT must stay green untouched. If it fails, the switch triple was changed; revert that.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/CompanionMessageJob.java backend/src/test/java/io/mrkuhne/mezo/feature/proactive/CompanionMessageJobIT.java
git commit -m "$(cat <<'EOF'
feat(proactive): schedule the 15:00 hydration checkpoint run (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: docs + CODEMAP + the full local gate

**Files:**
- Modify: `docs/features/proactive.md`
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Update `docs/features/proactive.md`.** Add a subsection under the companion-feed section documenting: the `hydration` kind (deterministic config text, one per user per day, no push, no lazy GET recovery); the two S2 channels (window fact block + 15:00 checkpoint); the probe's four silence gates (rest day, before wake, pro-rated floor, batch-logger guard); the pro-rated formula and its anchor source; and the cron/ArchUnit decision from Task 7's javadoc. Update the doc's `updated:` front-matter date to `2026-09-06` and add `HydrationShortfallProbe` to `key_files` if the section lists per-file anchors.

- [ ] **Step 2: Regenerate the codemap.**

```bash
node scripts/gen-codemap.mjs && node scripts/lint-docs.mjs
```

- [ ] **Step 3: Run the focused backend gate** — every IT this slice touched or could have broken:

```bash
./mvnw -pl backend test -Dtest='HydrationPropertiesIT,HydrationShortfallProbeIT,CompanionMessageHydrationIT,CompanionMessageGeneratorIT,CompanionMessageMissedWorkoutsIT,CompanionMessagePersistenceIT,CompanionMessageJobIT,CompanionMessageJobSwitchOffIT,ProactiveApiFeedIT,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Read Maven's own exit code and the "Tests run:" line. A filter that matches nothing is a FAILURE — if `ProactiveApiFeedIT` does not exist under that name, find the feed API IT (`ls backend/src/test/java/io/mrkuhne/mezo/feature/proactive/ | grep -i feed`) and use its real name.

- [ ] **Step 4: Run the frontend gate in BOTH modes plus the build** (the union change is one line, but `VITE_USE_MOCK` unset means mock — the real-mode run must be explicit):

```bash
cd frontend && pnpm test && VITE_USE_MOCK=false pnpm test && pnpm build
```

- [ ] **Step 5: Commit.**

```bash
git add docs/features/proactive.md docs/CODEMAP.md
git commit -m "$(cat <<'EOF'
docs(proactive): document the S2 training-day hydration channels (mezo-d58h.7.2)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: ship it through the CI gate

- [ ] **Step 1: Push the branch and open the self-PR.**

```bash
git push -u origin feat/proactive-round2-s2-hydration
```

```bash
gh pr create --title "feat(proactive): training-day hydration fact + 15:00 checkpoint — round 2 S2 (mezo-d58h.7.2)" --body "$(cat <<'EOF'
Round 2 S2 of `docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md` (spec item 12).

- `HydrationShortfallProbe`: training day + pro-rated (wake→bed fraction) water target + 60% threshold + batch-logger guard; four silence gates, each with its own IT.
- Midday/evening window prompts carry a deterministic HIDRATÁCIÓ fact block (the `missedWorkoutsBlock` idiom).
- New `hydration` feed kind: a ~15:00 checkpoint message, deterministic config text, emitted only when the shortfall holds — no push, no lazy GET recovery, no advice-card day gate involvement.
- Mirrors: entity constant, DB CHECK, OpenAPI `KindEnum`, FE `FeedMessageKind`.

The checkpoint rides a 4th cron on the existing `CompanionMessageJob` rather than the flag sweep: `companion → proactive` would close a new feature-slice cycle (see the method javadoc).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Wait for CI green** (`gh pr checks --watch`). CI is the authoritative full-suite gate; a red run is fixed on the branch and re-pushed, never merged around.

- [ ] **Step 3: Merge locally with `--no-ff`, push main, delete the branch.**

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/proactive-round2-s2-hydration && git push && git push origin --delete feat/proactive-round2-s2-hydration
```

- [ ] **Step 4: Close the bd issue and push beads.**

```bash
bd close mezo-d58h.7.2 && bd dolt push
```

---

## Self-review notes

- **Spec coverage.** §(12)'s three signal points: midday + evening (Task 5, one block on the shared `generateWindow` payload) and the ~15:00 checkpoint (Tasks 6–7). Pro-rated target: Task 3. 60 % threshold + batch-logger guard + training-day-only: Task 3, one IT each. "Emits a message only when the shortfall condition holds": Task 6's null path and its IT. Switch layout (`COMPANION` + `PROACTIVE`): the probe's `@ConditionalOnProperty` and the job's inherited triple, covered by `CompanionMessageJobSwitchOffIT`.
- **Deliberate spec deviations, both documented in code:** the checkpoint is a cron on `CompanionMessageJob` rather than a branch of the flag sweep (ArchUnit cycle), and it is config text rather than LLM prose.
- **Out of scope for S2** (do not creep): item (9)'s retro-logging fact is S3 and shares this slice's block idiom; the meal-rhythm, once-ever-question and energy-dip slices are S4–S6.
