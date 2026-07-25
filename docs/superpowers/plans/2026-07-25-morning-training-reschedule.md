# Morning-training reschedule + Tasty Dose/Origin protocol seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The M5 `morning_workout` habit cutoff derives from the sleep anchor (wake + 6h) instead of the static 12:00; a gentle Train·Mai card offers one-tap rescheduling of late gym slots into the wake-derived morning window; an idempotent demodata seed lands the two real stim products (Tasty Dose gombakávé, Origin PWO) + a v1 protocol.

**Architecture:** Backend swaps one `HabitProperties` key for an anchor-derived value (the `mezo-53su` CaffeineCutoffPort precedent — `HabitTargets`/`SleepAnchorPort` already injected) and adds one `@Profile("demodata")` `CommandLineRunner` (the `PantryCatalogLoader` pattern with a by-name guard). Frontend adds one pure logic module + one presentational card mounted on `TrainTodayPage`, wired to the existing `gymSlots` query + `saveGymSchedule` replace-all mutation. No API-contract change, no Liquibase migration.

**Tech Stack:** Java 21 / Spring Boot 4 / Maven / Postgres ITs (Testcontainers-optional fixed DB) · React 19 / Vite / vitest / TanStack Query.

**Spec:** `docs/superpowers/specs/2026-07-25-morning-training-reschedule-design.md` (D1–D8). **bd:** `mezo-67rb`. **Branch:** `feat/morning-training` (already checked out in this worktree).

## Global Constraints

- Working dir = this worktree (`…/.claude/worktrees/parallel-session-2`). Never `cd` to the main checkout except for `bd` commands (no `.dolt` in worktrees).
- Every commit: `git -c core.hooksPath=/dev/null commit` (the bd pre-commit hook pollutes worktree commits), subject in English carrying `(mezo-67rb)`, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- UI copy Hungarian; code/comments/commit messages English. Card tone per ADR 0010: no red, no guilt.
- Window formula (spec D1): **[wake + 60′, wake + 6h]**; offending = slot time **after window end** only (D3). `wake + 6h` reproduces the retired static 12:00 at the 06:00 backend ghost wake.
- BE local test gate (the 16 GB box OOMs on the full suite): `docker compose up -d` under `backend/`, then **focused** `./mvnw clean test -Dtest=… -DargLine=-Xmx3g`. ALWAYS `clean`. CI is the authoritative full gate.
- FE gate: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — both modes green.
- FE conventions (`docs/references/frontend_conventions.md`): hooks only from `@/data/hooks`, deep absolute `@/*` imports, no barrels, tests colocated, logic in `features/train/logic/`, presentational card in `features/train/components/`.
- No new `*Screen`/`*View`; no `@Value` on the backend; seed data in Java `@Profile("demodata")`, never SQL.

---

### Task 1: Backend — anchor the M5 workout cutoff (wake + 6h)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/config/HabitProperties.java`
- Modify: `backend/src/main/resources/application.yml` (~line 549, the `mezo.habit` block)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/habit/service/HabitEvaluator.java:80-86`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitEvaluatorIT.java`

**Interfaces:**
- Consumes: `HabitTargets.resolve(UUID).wake(): LocalTime` (already injected in `HabitEvaluator`); `RunningPopulator.createBlock(UUID, String, String)` + `createRunLog(UUID createdBy, UUID blockId, int weekNumber, String sessionKey, LocalDate date, Integer completedRounds, Integer rpeActual, Integer hrRecoverySec, String sprintLandmark, Integer durationMin)`; `SleepGoalPopulator.goal(UUID owner, int targetMinutes, String anchor, String anchorTime, int bandMin)`.
- Produces: `HabitProperties.workoutWindowHours(): int` (yml `mezo.habit.workout-window-hours: 6`); `RunningPopulator.createRunLogAt(UUID createdBy, UUID blockId, LocalDate date, Instant createdAt): RunSessionLogEntity` — Task 7's focused gate re-runs these tests.

- [ ] **Step 1: Add the backdating populator helper**

In `RunningPopulator.java` add imports `jakarta.persistence.EntityManager`, `jakarta.persistence.PersistenceContext`, `java.time.Instant`, `org.springframework.transaction.annotation.Transactional` (keep existing ones), a field, and a method (mirror of `WeightLogPopulator.createWeightLogAt`):

```java
    /** JPA-managed shared EntityManager — the {@code @CreationTimestamp} backdate needs a native update. */
    @PersistenceContext
    private EntityManager em;

    /** created_at backdate needs its own transaction — the base IT is non-transactional
     *  (the WeightLogPopulator.createWeightLogAt idiom). */
    @Transactional
    public RunSessionLogEntity createRunLogAt(UUID createdBy, UUID blockId, LocalDate date,
        Instant createdAt) {
        RunSessionLogEntity e = createRunLog(createdBy, blockId, 1, "tue-sprint", date, 6, 8, null, null, 30);
        em.createNativeQuery("update run_session_log set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return logRepository.findById(e.getId()).orElseThrow();
    }
```

Note: `RunningPopulator` is `@RequiredArgsConstructor`; the `em` field must NOT be `final` (it is `@PersistenceContext`-injected, exactly like `WeightLogPopulator`).

- [ ] **Step 2: Write the three failing ITs**

In `HabitEvaluatorIT.java`: add `@Autowired private RunningPopulator runningPopulator;` next to the other populators, and these tests:

```java
    @Test
    void testSatisfied_shouldPassTraining_whenRunLoggedBeforeAnchoredCutoff() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        sleepGoalPopulator.goal(owner, 450, "WAKE", "05:00", 15); // cutoff = 05:00 + 6h = 11:00
        var block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLogAt(owner, block.getId(), d, at(d, "10:30"));
        assertThat(evaluator.satisfied("training_done_today", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailTraining_whenRunLoggedAfterAnchoredCutoff() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        sleepGoalPopulator.goal(owner, 450, "WAKE", "05:00", 15); // cutoff = 11:00
        var block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLogAt(owner, block.getId(), d, at(d, "11:30"));
        assertThat(evaluator.satisfied("training_done_today", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldUseGhostWakeCutoff_whenNoSleepGoal() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        // no goal -> ghost wake 06:00 -> cutoff 12:00 (exactly the retired static value)
        var block = runningPopulator.createBlock(owner, "Sprint blokk", "active");
        runningPopulator.createRunLogAt(owner, block.getId(), d, at(d, "11:30"));
        assertThat(evaluator.satisfied("training_done_today", owner, d)).isTrue();
    }
```

Also rewrite the IT class javadoc's `<p>` paragraph (currently says a run-based path "would be time-of-day flaky"):

```java
 * <p>{@code training_done_today}'s gym branch is asserted via a completed instance dated today
 * (timestamp-less date-presence, no time gate); the RUN branch keys off the log's
 * {@code created_at} against the wake-anchored cutoff (wake + workout-window-hours), pinned
 * deterministically via {@link RunningPopulator#createRunLogAt}.
```

- [ ] **Step 3: Run to verify the new tests fail**

```bash
cd backend && docker compose up -d && ./mvnw clean test -Dtest=HabitEvaluatorIT -DargLine=-Xmx3g
```

Expected: the two anchored tests FAIL (`shouldFailTraining_whenRunLoggedAfterAnchoredCutoff` — 11:30 is still before the static 12:00 so `satisfied` is `true`); `shouldPassTraining…10:30` and the ghost test may already pass (10:30/11:30 < 12:00). The failure of the 11:30-with-goal test is the red bar that matters.

- [ ] **Step 4: Swap the config key and anchor the evaluator**

`HabitProperties.java` — replace the field `@NotBlank String workoutCutoff,` with:

```java
    @Min(1) int workoutWindowHours,
```

`application.yml` — in the `mezo.habit` block replace `    workout-cutoff: "12:00"` with:

```yaml
    workout-window-hours: 6   # M5 cutoff = sleep-anchor wake + this many hours (ghost wake 06:00 -> 12:00)
```

`HabitEvaluator.java` — replace the `training_done_today` case (lines 80-86) with:

```java
            case "training_done_today" -> {
                if (!workoutSessionRepository.findDoneInstanceDates(userId, date, date).isEmpty()) {
                    yield true;
                }
                // Run logs carry created_at, so the wake-anchored cutoff applies here (spec D2);
                // gym completion stays date-presence (no completed_at — honest fallback).
                LocalTime cutoff = habitTargets.resolve(userId).wake()
                    .plusHours(properties.workoutWindowHours());
                yield runSessionLogRepository
                    .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
                    .stream()
                    .anyMatch(r -> date.equals(r.getDate())
                        && localTime(r.getCreatedAt()).isBefore(cutoff));
            }
```

- [ ] **Step 5: Run to verify all HabitEvaluatorIT tests pass**

```bash
cd backend && ./mvnw clean test -Dtest=HabitEvaluatorIT -DargLine=-Xmx3g
```

Expected: BUILD SUCCESS, 0 failures (existing gym date-presence tests untouched and green).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/habit backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/habit/HabitEvaluatorIT.java
git -c core.hooksPath=/dev/null commit -m "feat(habit): anchor the M5 workout cutoff to the sleep wake (wake + 6h) (mezo-67rb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Backend — ProtocolSeedData (Tasty Dose + Origin PWO + v1 protocol)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedDataIT.java`

**Interfaces:**
- Consumes: `ProtocolService.activate(UUID, ProtocolActivateRequest)` (validates non-food kinds, supersede/version logic); `PantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(UUID)`; `ProtocolRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String)`; `OwnerProperties.ownerEmail()`; `PantryItemPopulator.createStim(UUID, String)`.
- Produces: `ProtocolSeedData.run()` (no-arg, `@Transactional`, idempotent) + package-visible constants `TASTY_DOSE_NAME`, `ORIGIN_PWO_NAME`, `SEED_REASON` — used by the IT and referenced in Task 6's docs.

- [ ] **Step 1: Write the failing IT**

`ProtocolSeedDataIT.java`:

```java
package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The demodata protocol seeder: two real stim products by-name-idempotently + a v1 protocol
 *  only when the owner has none — an existing active protocol is never touched (spec D6). */
class ProtocolSeedDataIT extends ApiIntegrationTest {

    @Autowired private ProtocolSeedData seed;
    @Autowired private PantryItemRepository pantryItemRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolItemRepository protocolItemRepository;
    @Autowired private ProtocolService protocolService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PantryItemPopulator pantryItemPopulator;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testRun_shouldSeedItemsAndActivateProtocol_whenCleanSlate() {
        UUID owner = ownerId();
        seed.run();
        var items = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        var tasty = items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.TASTY_DOSE_NAME)).findFirst().orElseThrow();
        var origin = items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME)).findFirst().orElseThrow();
        assertThat(tasty.getKind()).isEqualTo("stim");
        assertThat(tasty.getCaffeine()).isTrue();
        assertThat(tasty.getDose()).isEqualTo("8 g");
        assertThat(tasty.getTiming()).isEqualTo("morning");
        assertThat(tasty.getStockQty()).isEqualByComparingTo(new BigDecimal("30"));
        assertThat(origin.getKind()).isEqualTo("stim");
        assertThat(origin.getCaffeine()).isTrue();
        assertThat(origin.getTiming()).isEqualTo("pre-workout");

        var active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElseThrow();
        assertThat(active.getVersion()).isEqualTo(1);
        assertThat(active.getLastReplanReason()).isEqualTo(ProtocolSeedData.SEED_REASON);
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(active.getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .containsExactly(tasty.getId(), origin.getId());
    }

    @Test
    void testRun_shouldStayIdempotent_whenRunTwice() {
        UUID owner = ownerId();
        seed.run();
        seed.run();
        var items = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.TASTY_DOSE_NAME))).hasSize(1);
        assertThat(items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME))).hasSize(1);
        assertThat(protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(owner)).hasSize(1);
    }

    @Test
    void testRun_shouldSkipExistingItemByName_whenOwnerAlreadyHasIt() {
        UUID owner = ownerId();
        var existing = pantryItemPopulator.createStim(owner, ProtocolSeedData.TASTY_DOSE_NAME);
        seed.run();
        var sameName = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.TASTY_DOSE_NAME)).toList();
        assertThat(sameName).hasSize(1);
        assertThat(sameName.getFirst().getId()).isEqualTo(existing.getId());
        var active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElseThrow();
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(active.getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .contains(existing.getId());
    }

    @Test
    void testRun_shouldNotTouchExistingActiveProtocol_whenOneExists() {
        UUID owner = ownerId();
        var mine = pantryItemPopulator.createStim(owner, "Sajat koffein");
        protocolService.activate(owner, new ProtocolActivateRequest()
            .selectedPantryItemIds(List.of(mine.getId())).reason("user protocol"));
        seed.run();
        var all = protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(owner);
        assertThat(all).hasSize(1);
        assertThat(all.getFirst().getVersion()).isEqualTo(1);
        assertThat(all.getFirst().getLastReplanReason()).isEqualTo("user protocol");
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(all.getFirst().getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .containsExactly(mine.getId());
        // items are still seeded even when the protocol is left alone
        assertThat(pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME))).hasSize(1);
    }
}
```

- [ ] **Step 2: Run to verify it fails to compile**

```bash
cd backend && ./mvnw clean test -Dtest=ProtocolSeedDataIT -DargLine=-Xmx3g
```

Expected: COMPILATION ERROR — `ProtocolSeedData` does not exist.

- [ ] **Step 3: Implement the seed**

`ProtocolSeedData.java`:

```java
package io.mrkuhne.mezo.feature.fuel;

import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the owner's two real stim products (Tasty Dose gombakávé + Origin PWO) and — only when the
 * owner has no active protocol yet — activates a v1 protocol containing them (mezo-67rb, spec D6).
 * {@code @Profile("demodata")} is the profile prod runs, so the rows land on the live DB at the
 * next deploy. Idempotent by NAME per item (the shelf is curated — {@code PantryCatalogLoader}'s
 * empty-shelf guard would never fire here) and by active-protocol presence; an existing active
 * protocol is never touched. Runs after {@code PantryCatalogLoader} (60).
 */
@Slf4j
@Component
@Profile("demodata")
@Order(65)
@RequiredArgsConstructor
public class ProtocolSeedData implements CommandLineRunner {

    static final String TASTY_DOSE_NAME = "Tasty Dose gombakávé";
    static final String ORIGIN_PWO_NAME = "Origin PWO";
    static final String SEED_REASON = "seed: video-1 (4) protocol setup (mezo-67rb)";

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final PantryItemRepository pantryItemRepository;
    private final ProtocolRepository protocolRepository;
    private final ProtocolService protocolService;

    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the integration test to re-run against a reset DB. */
    @Transactional
    public void run() {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return; // no owner yet (non-demodata path) — nothing to seed
        }
        UUID ownerId = owner.getId();
        UUID tastyDose = ensureItem(ownerId, tastyDose(ownerId));
        UUID originPwo = ensureItem(ownerId, originPwo(ownerId));
        if (protocolRepository.findByCreatedByAndStatusAndDeletedFalse(ownerId, "active").isEmpty()) {
            protocolService.activate(ownerId, new ProtocolActivateRequest()
                .selectedPantryItemIds(List.of(tastyDose, originPwo))
                .reason(SEED_REASON));
            log.info("protocol seed: activated v1 with Tasty Dose + Origin PWO (mezo-67rb)");
        }
    }

    /** By-name idempotency: an item the owner already has (however edited) is never re-seeded. */
    private UUID ensureItem(UUID ownerId, PantryItemEntity candidate) {
        return pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(ownerId).stream()
            .filter(p -> candidate.getName().equals(p.getName()))
            .findFirst()
            .map(PantryItemEntity::getId)
            .orElseGet(() -> pantryItemRepository.save(candidate).getId());
    }

    private PantryItemEntity tastyDose(UUID ownerId) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(ownerId);
        e.setKind("stim");
        e.setName(TASTY_DOSE_NAME);
        e.setBrand("Tasty Dose");
        e.setSource("manual");
        e.setCategory("caffeine");
        e.setDose("8 g");
        e.setForm("por · 1 púpozott mérőkanál · 200 ml forró vízbe");
        e.setStockQty(new BigDecimal("30"));
        e.setStockUnit("adag");
        e.setProtocol("Reggel, súlymérés után · 100 mg koffein/adag (guarana) · 14:00 cutoff");
        e.setTiming("morning");
        e.setCaffeine(true);
        e.setServingAmount(new BigDecimal("8"));
        e.setServingUnit("g");
        e.setNotes("Gomba-blend/adag: Tremella 504 mg · Lion's Mane 400 mg · Shiitake 250 mg · "
            + "Maitake 200 mg · Samsoniella 200 mg · Reishi 100 mg · Cordyceps 48 mg; "
            + "ashwagandha 160 mg · L-tirozin 150 mg · rhodiola 100 mg · magnézium 60 mg");
        return e;
    }

    private PantryItemEntity originPwo(UUID ownerId) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(ownerId);
        e.setKind("stim");
        e.setName(ORIGIN_PWO_NAME);
        e.setBrand("Origin");
        e.setSource("manual");
        e.setCategory("caffeine");
        e.setDose("20 g");
        e.setForm("por · 1 napi adag · kékmálna");
        e.setStockQty(new BigDecimal("25")); // estimated, not from the label — correctable in the Kamra
        e.setStockUnit("adag");
        e.setProtocol("Pre-workout T-30min · 300 mg koffein/adag · 14:00 előtt");
        e.setTiming("pre-workout");
        e.setCaffeine(true);
        e.setServingAmount(new BigDecimal("20"));
        e.setServingUnit("g");
        e.setNotes("20 g adagonként: L-citrullin-DL-malát 8 g · AAKG 4 g · béta-alanin 3,5 g · L-teanin 250 mg");
        return e;
    }
}
```

- [ ] **Step 4: Run to verify all four IT tests pass**

```bash
cd backend && ./mvnw clean test -Dtest=ProtocolSeedDataIT -DargLine=-Xmx3g
```

Expected: BUILD SUCCESS, 4 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedData.java backend/src/test/java/io/mrkuhne/mezo/feature/fuel/ProtocolSeedDataIT.java
git -c core.hooksPath=/dev/null commit -m "feat(fuel): demodata seed for Tasty Dose + Origin PWO stim items + v1 protocol (mezo-67rb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Frontend — `morningWindow` pure logic

**Files:**
- Create: `frontend/src/features/train/logic/morningWindow.ts`
- Test: `frontend/src/features/train/logic/morningWindow.test.ts`

**Interfaces:**
- Consumes: `GymScheduleSlot { dayOfWeek: number; time: string }` from `@/data/types`.
- Produces (Task 4 imports these exact names): `WINDOW_HOURS = 6`, `WINDOW_START_OFFSET_MIN = 60`, `SNOOZE_KEY = 'mezo-morning-training-snooze'`, `interface MorningWindow { start: string; end: string }`, `morningWindow(wakeTime: string): MorningWindow`, `offendingSlots(slots, window): GymScheduleSlot[]`, `rescheduledSlots(slots, window): GymScheduleSlot[]`, `snoozeHash(wakeTime, offending): string`, `isSnoozed(hash): boolean`, `snooze(hash): void`.

- [ ] **Step 1: Write the failing tests**

`morningWindow.test.ts`:

```ts
import { expect, test } from 'vitest'
import {
  isSnoozed,
  morningWindow,
  offendingSlots,
  rescheduledSlots,
  snooze,
  snoozeHash,
  SNOOZE_KEY,
} from '@/features/train/logic/morningWindow'

const slots = [
  { dayOfWeek: 1, time: '18:30' },
  { dayOfWeek: 3, time: '07:50' },
]

test('morningWindow derives [wake+60m, wake+6h]', () => {
  expect(morningWindow('06:45')).toEqual({ start: '07:45', end: '12:45' })
  expect(morningWindow('06:00')).toEqual({ start: '07:00', end: '12:00' }) // ghost wake = the retired static 12:00
})

test('offendingSlots keeps only after-window-end slots — early-morning passes (spec D3)', () => {
  const w = morningWindow('06:45')
  expect(offendingSlots(slots, w)).toEqual([{ dayOfWeek: 1, time: '18:30' }])
  expect(offendingSlots([{ dayOfWeek: 0, time: '07:00' }], w)).toEqual([])
})

test('rescheduledSlots moves offenders to the window start, passes the rest', () => {
  const w = morningWindow('06:45')
  expect(rescheduledSlots(slots, w)).toEqual([
    { dayOfWeek: 1, time: '07:45' },
    { dayOfWeek: 3, time: '07:50' },
  ])
})

test('snooze is content-keyed: same state stays snoozed, changed state re-arms (spec D4)', () => {
  localStorage.removeItem(SNOOZE_KEY)
  const hash = snoozeHash('06:45', [{ dayOfWeek: 1, time: '18:30' }])
  expect(isSnoozed(hash)).toBe(false)
  snooze(hash)
  expect(isSnoozed(hash)).toBe(true)
  expect(isSnoozed(snoozeHash('06:30', [{ dayOfWeek: 1, time: '18:30' }]))).toBe(false)
  expect(isSnoozed(snoozeHash('06:45', [{ dayOfWeek: 2, time: '19:00' }]))).toBe(false)
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm test -- morningWindow
```

Expected: FAIL — module `@/features/train/logic/morningWindow` not found.

- [ ] **Step 3: Implement**

`morningWindow.ts`:

```ts
import type { GymScheduleSlot } from '@/data/types'

/** FE mirror of `mezo.habit.workout-window-hours` (M5 cutoff = wake + this many hours). */
export const WINDOW_HOURS = 6
/** Coffee-first start offset (the buildDayPlan "reggeli = wake+45" constant-family). */
export const WINDOW_START_OFFSET_MIN = 60
export const SNOOZE_KEY = 'mezo-morning-training-snooze'

export interface MorningWindow {
  start: string
  end: string
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHHmm = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** The wake-anchored morning training window: [wake + 60', wake + 6h] (spec D1). */
export function morningWindow(wakeTime: string): MorningWindow {
  const wake = toMin(wakeTime)
  return { start: toHHmm(wake + WINDOW_START_OFFSET_MIN), end: toHHmm(wake + WINDOW_HOURS * 60) }
}

/** Slots AFTER the window end — an earlier-than-start slot is still morning training (spec D3). */
export function offendingSlots(slots: GymScheduleSlot[], window: MorningWindow): GymScheduleSlot[] {
  return slots.filter((s) => s.time > window.end)
}

/** Full replacement list for the one-tap PUT: offenders land on the window start, rest pass. */
export function rescheduledSlots(slots: GymScheduleSlot[], window: MorningWindow): GymScheduleSlot[] {
  return slots.map((s) => (s.time > window.end ? { ...s, time: window.start } : s))
}

/** Content key: the snooze holds this exact state — any schedule/wake change re-arms the card. */
export function snoozeHash(wakeTime: string, offending: GymScheduleSlot[]): string {
  return `${wakeTime}|${offending.map((s) => `${s.dayOfWeek}@${s.time}`).join(',')}`
}

export function isSnoozed(hash: string): boolean {
  try {
    return localStorage.getItem(SNOOZE_KEY) === hash
  } catch {
    return false
  }
}

export function snooze(hash: string): void {
  try {
    localStorage.setItem(SNOOZE_KEY, hash)
  } catch {
    /* storage unavailable — best effort */
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd frontend && pnpm test -- morningWindow
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/logic/morningWindow.ts frontend/src/features/train/logic/morningWindow.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(train): wake-anchored morning-window logic + content-keyed snooze (mezo-67rb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Frontend — `MorningTrainingCard` + mount on TrainTodayPage + CSS

**Files:**
- Create: `frontend/src/features/train/components/MorningTrainingCard.tsx`
- Test: `frontend/src/features/train/components/MorningTrainingCard.test.tsx`
- Modify: `frontend/src/features/train/pages/TrainTodayPage.tsx` (hooks at top ~L33-42; mount between `<LoadTiles …/>` ~L429 and the "Heti terv" section ~L432)
- Modify: `frontend/src/features/train/pages/TrainTodayPage.test.tsx` (2 new tests + snooze-key hygiene)
- Modify: `frontend/src/styles/prototype.css` (append the `.mtr` family after the `.sesc` block, ~L1971)

**Interfaces:**
- Consumes: Task 3's `morningWindow`/`offendingSlots`/`rescheduledSlots`/`snoozeHash`/`isSnoozed`/`snooze`/`SNOOZE_KEY`; `useTrain().gymSlots: GymScheduleSlot[]` + `useTrain().saveGymSchedule(slots)` (mock no-op); `useSleepGoal().goal.wakeTime: string` (mock wake `06:45` → window `07:45–12:45`; mock gym slots Kedd/Csü `18:30` → both offending); `DAY_ORDER` from `@/data/train/train` (`DAY_ORDER[dayOfWeek]` → `'Hét'|'Kedd'|…`); `isMockMode` from `@/data/_client/mode` — **a function**, call it: `isMockMode()`; `useQueryClient` from `@tanstack/react-query` (cache key `['train', 'gymSchedule']`).
- Produces: `MorningTrainingCard({ offending, windowStart, windowEnd, onApply, onSnooze })` — presentational only.

- [ ] **Step 1: Write the failing card test**

`MorningTrainingCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { MorningTrainingCard } from '@/features/train/components/MorningTrainingCard'

test('lists offending slots with the target and fires both actions', () => {
  const onApply = vi.fn()
  const onSnooze = vi.fn()
  render(
    <MorningTrainingCard
      offending={[
        { dayOfWeek: 1, time: '18:30' },
        { dayOfWeek: 3, time: '18:30' },
      ]}
      windowStart="07:45"
      windowEnd="12:45"
      onApply={onApply}
      onSnooze={onSnooze}
    />,
  )
  expect(screen.getByText(/07:45–12:45/)).toBeInTheDocument()
  expect(screen.getByText(/Kedd 18:30 · Csü 18:30/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Áthelyezés a reggeli ablakba' }))
  expect(onApply).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Maradjon így' }))
  expect(onSnooze).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd frontend && pnpm test -- MorningTrainingCard
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the card**

`MorningTrainingCard.tsx`:

```tsx
import { DAY_ORDER } from '@/data/train/train'
import type { GymScheduleSlot } from '@/data/types'

/** Gentle anchor-consumer nudge (mezo-67rb): offer moving late gym slots into the
 *  wake-derived morning window. Presentational — the page owns data + snooze. */
export function MorningTrainingCard({
  offending,
  windowStart,
  windowEnd,
  onApply,
  onSnooze,
}: {
  offending: GymScheduleSlot[]
  windowStart: string
  windowEnd: string
  onApply: () => void
  onSnooze: () => void
}) {
  return (
    <section className="mtr" aria-label="Reggeli edzés-ablak">
      <span className="mtr-eye">Reggeli edzés</span>
      <p className="mtr-lead">
        A reggeli mozgás előrébb tolja a belső órát — este könnyebben alszol el. A horgonyod
        szerint az ablakod {windowStart}–{windowEnd}.
      </p>
      <p className="mtr-body">
        {offending.map((s) => `${DAY_ORDER[s.dayOfWeek]} ${s.time}`).join(' · ')} → {windowStart}
      </p>
      <div className="mtr-actions">
        <button className="mtr-cta" onClick={onApply}>Áthelyezés a reggeli ablakba</button>
        <button className="mtr-quiet" onClick={onSnooze}>Maradjon így</button>
      </div>
    </section>
  )
}
```

Append to `prototype.css` (directly after the `.sesc-quiet` rule):

```css

/* ===== Morning-training reschedule nudge (mezo-67rb): Train · Mai anchor-consumer card ===== */
.mtr { display: flex; flex-direction: column; gap: 7px; margin-top: 8px; padding: 16px;
       border-radius: 20px; background: linear-gradient(150deg, var(--wash-sage) 0%, var(--surface) 75%);
       box-shadow: 0 1px 3px rgba(43,33,24,.06); }
.mtr-eye { font: 700 10px/1 var(--ff-body); letter-spacing: .1em; color: var(--sage-deep); text-transform: uppercase; }
.mtr-lead { font: 600 13.5px/1.5 var(--ff-body); color: var(--ink); }
.mtr-body { font: 500 12.5px/1.6 var(--ff-body); color: var(--sub); }
.mtr-actions { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
.mtr-cta { background: var(--sage-deep); color: var(--text-inverse); font: 700 12px/1 var(--ff-body);
           padding: 10px 16px; border-radius: 999px; }
.mtr-quiet { font: 600 11.5px/1 var(--ff-body); color: var(--faint); padding: 10px 8px; }
```

- [ ] **Step 4: Run the card test to verify it passes**

```bash
cd frontend && pnpm test -- MorningTrainingCard
```

Expected: 1 passed.

- [ ] **Step 5: Wire it into TrainTodayPage**

In `TrainTodayPage.tsx`:

1. Change line 8 `import { useState } from 'react'` to `import { useEffect, useState } from 'react'`; add imports:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { isMockMode } from '@/data/_client/mode'
import { MorningTrainingCard } from '@/features/train/components/MorningTrainingCard'
import {
  isSnoozed,
  morningWindow,
  offendingSlots,
  rescheduledSlots,
  snooze,
  snoozeHash,
} from '@/features/train/logic/morningWindow'
```

(`isMockMode` is `export const isMockMode = () => import.meta.env.VITE_USE_MOCK !== 'false'` — call it inside the component body, never at module scope, so `vi.stubEnv` works in tests.)

2. Extend the `useTrain()` destructure with `gymSlots, saveGymSchedule`, and add `useSleepGoal` to the existing `@/data/hooks` import. With the other hooks at the top (BEFORE the early returns):

```tsx
  const { goal: sleepGoal } = useSleepGoal()
  const qc = useQueryClient()
  // Morning-training reschedule (mezo-67rb): wake-anchored window over the raw gym slots.
  const mtrWindow = morningWindow(sleepGoal.wakeTime)
  const mtrOffending = offendingSlots(gymSlots, mtrWindow)
  const mtrHash = snoozeHash(sleepGoal.wakeTime, mtrOffending)
  const [mtrSnoozed, setMtrSnoozed] = useState(false)
  useEffect(() => setMtrSnoozed(false), [mtrHash])
  const showMtr = mtrOffending.length > 0 && !mtrSnoozed && !isSnoozed(mtrHash)
  const applyMtr = () => {
    const moved = rescheduledSlots(gymSlots, mtrWindow)
    saveGymSchedule(moved)
    if (isMockMode()) qc.setQueryData(['train', 'gymSchedule'], moved) // mock parity: the mock mutation no-ops
  }
  const snoozeMtr = () => {
    snooze(mtrHash)
    setMtrSnoozed(true)
  }
```

3. Mount between `<LoadTiles tiles={weeklyLoad(agenda)} />` and the "Heti terv" section:

```tsx
      {showMtr && (
        <MorningTrainingCard
          offending={mtrOffending}
          windowStart={mtrWindow.start}
          windowEnd={mtrWindow.end}
          onApply={applyMtr}
          onSnooze={snoozeMtr}
        />
      )}
```

- [ ] **Step 6: Add the page-level tests**

In `TrainTodayPage.test.tsx`: import `SNOOZE_KEY` from `@/features/train/logic/morningWindow`, add `localStorage.removeItem(SNOOZE_KEY)` to the existing `beforeEach` (the card state must not leak between tests), and append:

```tsx
test('morning-training card lists the late gym slots and one-tap reschedules them', () => {
  renderView()
  // mock gym slots Kedd/Csü 18:30 vs mock wake 06:45 -> window 07:45–12:45
  expect(screen.getByText(/Kedd 18:30 · Csü 18:30/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Áthelyezés a reggeli ablakba' }))
  // cache mutated -> both slots at 07:45 -> nothing offending -> card gone
  expect(screen.queryByText(/Kedd 18:30/)).toBeNull()
})

test('morning-training card snooze survives a remount for the same schedule+wake', () => {
  const first = renderView()
  fireEvent.click(screen.getByRole('button', { name: 'Maradjon így' }))
  expect(screen.queryByText(/Kedd 18:30/)).toBeNull()
  first.unmount()
  renderView()
  expect(screen.queryByText(/Kedd 18:30/)).toBeNull()
})
```

- [ ] **Step 7: Run the page tests in both modes**

```bash
cd frontend && pnpm test -- TrainTodayPage && VITE_USE_MOCK=true pnpm test -- TrainTodayPage
```

Expected: all pass, including the pre-existing tests (the card adds elements but no existing assertion collides; if one does, fix the assertion to be more specific, never weaken the card behavior).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/train/components/MorningTrainingCard.tsx frontend/src/features/train/components/MorningTrainingCard.test.tsx frontend/src/features/train/pages/TrainTodayPage.tsx frontend/src/features/train/pages/TrainTodayPage.test.tsx frontend/src/styles/prototype.css
git -c core.hooksPath=/dev/null commit -m "feat(train): MorningTrainingCard one-tap reschedule into the wake-anchored window (mezo-67rb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend — mock stash: Tasty Dose + Origin PWO replace the generic trio

**Files:**
- Modify: `frontend/src/data/fuel/fuel.ts:430-472` (the `supplementsStash` items `aakg`, `betaalanin`, `caffeine200`)
- Modify: `frontend/src/data/fuel/pantry.ts:204` (`ing-aakg`'s `stashRefId`)
- Modify: `frontend/src/features/fuel/logic/buildProtocol.ts` (~L50-70 morning item label; ~L99-118 pre-workout stack)
- Modify: `frontend/src/features/fuel/logic/kamraItems.ts:8` (comment)
- Test: `frontend/src/features/fuel/logic/kamraItems.test.ts` (count comment + assertions)

**Interfaces:**
- Consumes: `SupplementStashItem` (`@/data/types`); `buildProtocol`'s `find(...needles)` name/id substring matcher.
- Produces: mock stash ids `tastydose` and `origin-pwo` (9 stash items total); `buildProtocol` emits the PWO as a single pre-workout item when present, and the morning caffeine item's label is the item's own `name`.

- [ ] **Step 1: Replace the three stash objects in `fuel.ts`**

Delete the `aakg`, `betaalanin`, `caffeine200` objects (currently lines 430-472, between the `whey` item and the `kohi` item) and insert in their place:

```ts
  {
    id: 'origin-pwo',
    name: 'Origin PWO',
    brand: 'Origin',
    type: 'stimulant',
    category: 'caffeine',
    dose: '20g',
    form: 'por · 1 napi adag · kékmálna',
    stock: 25,
    stockUnit: 'adag',
    protocol: 'Pre-workout T-30min · 300mg koffein · 14:00 előtt',
    timing: 'pre-workout',
    taken: false,
    caffeine: true,
  },
  {
    id: 'tastydose',
    name: 'Tasty Dose gombakávé',
    brand: 'Tasty Dose',
    type: 'stimulant',
    category: 'caffeine',
    dose: '8g',
    form: 'por · 1 púpozott mérőkanál · 200ml forró víz',
    stock: 30,
    stockUnit: 'adag',
    protocol: 'Reggel, súlymérés után · 100mg koffein · 14:00 cutoff',
    timing: 'morning',
    taken: true,
    caffeine: true,
  },
```

(`tastydose` sits before `kohi`, so `buildProtocol`'s `find('kávé', …)` picks the gombakávé as the morning coffee — the M4 habit's actual product.)

- [ ] **Step 2: Drop the dangling stash link in `pantry.ts`**

In the `ing-aakg` object change the line

```ts
    stashRefId: 'aakg', scrapedAt: 'Máj 02 · 21:15', warning: 'stim',
```

to

```ts
    scrapedAt: 'Máj 02 · 21:15', warning: 'stim',
```

- [ ] **Step 3: Adapt `buildProtocol.ts`**

(a) Morning caffeine item — replace the hardcoded label pair

```ts
      wakeItems.push({
        refId: morningCaff.id,
        name: morningCaff === coffee ? 'Espresso · 1 shot' : 'Koffein 200mg',
        dose: morningCaff.dose,
        color: 'var(--warning)',
      })
```

with

```ts
      wakeItems.push({
        refId: morningCaff.id,
        name: morningCaff.name,
        dose: morningCaff.dose,
        color: 'var(--warning)',
      })
```

(b) Pre-workout stack — replace the block head

```ts
  // Pre-workout stack
  const aakg = find('aakg')
  const beta = find('beta-alanin', 'betaalanin', 'béta-alanin')
  if (aakg || beta) {
    const preItems: ProtocolSlotItem[] = []
    if (aakg) preItems.push({ refId: aakg.id, name: 'AAKG · L-Arginine', dose: aakg.dose, color: 'var(--warning)' })
    if (beta) preItems.push({ refId: beta.id, name: 'Beta-Alanin', dose: beta.dose, color: 'var(--warning)' })
```

with

```ts
  // Pre-workout stack — a combined PWO product wins; separate AAKG/Beta-Alanin
  // items stay the fallback for stashes that carry them individually.
  const pwo = find('pwo', 'pre-workout')
  const aakg = find('aakg')
  const beta = find('beta-alanin', 'betaalanin', 'béta-alanin')
  if (pwo || aakg || beta) {
    const preItems: ProtocolSlotItem[] = []
    if (pwo) {
      preItems.push({ refId: pwo.id, name: pwo.name, dose: pwo.dose, color: 'var(--warning)' })
    } else {
      if (aakg) preItems.push({ refId: aakg.id, name: 'AAKG · L-Arginine', dose: aakg.dose, color: 'var(--warning)' })
      if (beta) preItems.push({ refId: beta.id, name: 'Beta-Alanin', dose: beta.dose, color: 'var(--warning)' })
    }
```

(the rest of the slot push — time/window/kind/reasoning — stays untouched; the reasoning prose still holds, the PWO contains AAKG + beta-alanine).

- [ ] **Step 4: Update the kamra comment + test**

`kamraItems.ts:8` comment: change `(whey/kreatin/aakg are both in `ingredients` and the stash)` to `(whey/kreatin are both in `ingredients` and the stash)`.

`kamraItems.test.ts` third test: the stash is now 9 items with 2 ingredient-linked twins, so the count stays 25 — update the comment and drop the dead assertion:

```ts
  expect(items).toHaveLength(25) // 18 ingredients + (9 stash − 2 linked: whey/kreatin)
  // linked stash twins are NOT duplicated as stash-only items
  const stashOnlyIds = items.filter(i => i.isStashOnly).map(i => i.id)
  expect(stashOnlyIds).not.toContain('stash-whey')
  expect(stashOnlyIds).not.toContain('stash-kreatin')
  expect(stashOnlyIds).toContain('stash-tastydose')
  expect(stashOnlyIds).toContain('stash-origin-pwo')
```

(If the built id prefix differs from `stash-<id>`, read `kamraItems.ts` and use its exact prefix.)

- [ ] **Step 5: Run the fuel logic tests in both modes**

```bash
cd frontend && pnpm test -- buildProtocol kamraItems && VITE_USE_MOCK=true pnpm test -- buildProtocol kamraItems
```

Expected: all pass — `buildProtocol.test.ts`'s "same slot kinds" test still holds (slug stash: PWO branch; realStash: AAKG/beta fallback → both emit `pre-workout`).

- [ ] **Step 6: Full FE suite both modes (stash ripples can surface anywhere in fuel)**

```bash
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: green. If a FuelStackPage/Kamra test asserts a removed item name (`AAKG · L-Arginine`, `Beta-Alanin`, `Koffein` as stash entries), update the fixture expectation to the new items — the two real products are the source of truth now.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/fuel/fuel.ts frontend/src/data/fuel/pantry.ts frontend/src/features/fuel/logic/buildProtocol.ts frontend/src/features/fuel/logic/kamraItems.ts frontend/src/features/fuel/logic/kamraItems.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): mock stash carries the real Tasty Dose + Origin PWO stim products (mezo-67rb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Living docs + design-system registration + cluster-notes

**Files:**
- Modify: `docs/features/habit.md` (§5 `← Sleep goal` bullet area, §8 tests line ~L136, §9 D6 line ~L142, §10 config line ~L155)
- Modify: `docs/features/train.md` (§2 Mai tab, §5 integrations table, §8 FE tests, §10 key files)
- Modify: `docs/features/fuel.md` (§4 Stack/Protocol contract block ~L136 + §9)
- Modify: `docs/features/me.md` (~L240 anchor-consumer paragraph)
- Modify: `docs/features/_platform-design-system.md` (the CSS-family registry where `.sstat`/`.sesc` were added)
- Modify: `docs/superpowers/specs/2026-07-23-sleep-routine-cluster-notes.md` (§0, §3 diagram, §5)

**Interfaces:**
- Consumes: everything Tasks 1–5 shipped (names: `workout-window-hours`, `ProtocolSeedData`, `morningWindow.ts`, `MorningTrainingCard`, `.mtr` family, mock ids `tastydose`/`origin-pwo`).
- Produces: lint-clean living docs; the cluster-notes ④ line flipped to done.

- [ ] **Step 1: habit.md** — in §5's `← Sleep goal` bullet add one sentence: since `mezo-67rb` the M5 `training_done_today` run-branch cutoff is **wake-anchored** (`SleepAnchorPort` wake + `mezo.habit.workout-window-hours`, default 6 — ghost wake 06:00 reproduces the retired static 12:00); `HabitProperties.workoutCutoff` + the `workout-cutoff` yml key are **removed** (the `mezo-53su` precedent). Update §8's `HabitEvaluatorIT` sentence (run-branch cases via `RunningPopulator.createRunLogAt` backdating), §9's D6 line and §10's `HabitProperties` note accordingly.

- [ ] **Step 2: train.md** — §2 Mai tab: one sentence on the `MorningTrainingCard` (shows when a gym slot falls after the wake-derived window end; one-tap `saveGymSchedule` replace-all; content-keyed localStorage snooze `mezo-morning-training-snooze`; ADR 0010 tone). §5: add an integration row `Sleep goal → Train (read)` — `useSleepGoal().goal.wakeTime` feeds `features/train/logic/morningWindow.ts` ([wake+60′, wake+6h], the FE mirror of `mezo.habit.workout-window-hours`). §8: the two new page tests + the logic/card tests. §10: list `features/train/logic/morningWindow.ts`, `features/train/components/MorningTrainingCard.tsx`.

- [ ] **Step 3: fuel.md** — §4 Stack/Protocol block: add that `ProtocolSeedData` (`@Profile("demodata")`, `@Order(65)`) seeds the two real stim `pantry_item`s **by-name-idempotently** and activates a v1 protocol only when no active one exists (never touches an existing protocol; prod runs demodata → the live DB receives them on deploy). §9: the mock-stash swap (generic `aakg`/`betaalanin`/`caffeine200` → `origin-pwo` + `tastydose`; `buildProtocol` prefers a combined PWO and labels the morning caffeine by item name).

- [ ] **Step 4: me.md** — in the ~L240 anchor paragraph extend the consumer list: since `mezo-67rb` the morning-training window is the third FE consumer (`morningWindow.ts` on Train·Mai) and the habit M5 cutoff resolves through the same anchor on the backend.

- [ ] **Step 5: _platform-design-system.md** — register the `.mtr` family (morning-training nudge card, sage wash) in the same registry section where `.sstat`/`.sesc` were registered (commit `f98351c8` precedent).

- [ ] **Step 6: cluster-notes** — §0: add a "Landed" line for `mezo-67rb` (branch `feat/morning-training`, the last video-1 slice ④; wake-anchored M5 + nudge card + protocol seed). §3: flip the ④ line to `✅ DONE (mezo-67rb)`. §5: drop the "morning-training reschedule" thread from the next-session playbook (C4/C5 remain).

- [ ] **Step 7: Lint + commit**

```bash
node scripts/lint-docs.mjs
git add docs/
git -c core.hooksPath=/dev/null commit -m "docs: living docs for the morning-training reschedule + protocol seed slice (mezo-67rb)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Expected: lint green (no orphans/broken links/stale flags on the touched docs).

---

### Task 7: Gates, PR, land

**Files:** none new — verification + landing.

- [ ] **Step 1: FE full gate**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Expected: build + both modes green.

- [ ] **Step 2: BE focused gate** (compose up; the full suite is CI's job)

```bash
cd backend && ./mvnw clean test -Dtest='HabitEvaluatorIT,HabitServiceIT,HabitApiIT,ProtocolSeedDataIT,ArchitectureTest' -DargLine=-Xmx3g
```

Expected: BUILD SUCCESS, 0 failures.

- [ ] **Step 3: Push + self-PR**

```bash
git push -u origin feat/morning-training
gh pr create --title "feat: morning-training reschedule + Tasty Dose/Origin protocol seed (mezo-67rb)" --body "Video-1 slice ④ — the last anchor consumer. Wake-anchored M5 cutoff (wake+6h, ghost-compat 12:00), MorningTrainingCard one-tap gym-slot reschedule on Train·Mai, ProtocolSeedData demodata seed (by-name idempotent; prod receives it on deploy). Spec: docs/superpowers/specs/2026-07-25-morning-training-reschedule-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 4: CI green, then merge from the worktree** (the main checkout is busy — the `gh pr merge` landing path per project memory)

```bash
gh pr checks --watch
gh pr merge --merge
```

Expected: CI green before merge; PR merges and auto-closes.

- [ ] **Step 5: bd close + handoff** (bd from the MAIN checkout — no `.dolt` in worktrees)

```bash
(cd /Users/daniel.kuhne/MrKuhne/mezo && bd close mezo-67rb && bd update mezo-67rb --notes="Landed via PR merge (feat/morning-training). Wake-anchored M5 cutoff (workout-window-hours 6), MorningTrainingCard on Train Mai, ProtocolSeedData (Tasty Dose + Origin PWO + v1 protocol, by-name idempotent). Post-deploy: verify the two items + protocol appear on the live app (demodata runs in prod); local main + bd dolt push deferred to the main checkout session." && bd dolt push)
```

Note: local `main` in the main checkout is NOT updated here (another session owns it); the merged state arrives with its next `git pull --rebase`. The live k3s DB receives the seed on the next deploy — verify the Kamra/Stack surfaces afterwards.
