# Progression P3a — Run Path (+ award refactor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a logged run session (sprint or steady) award XP and return a `levelUp` payload — by first extracting `applyGym`'s shared tail into a reusable `award(...)`, then adding a `RunSignal` + calculator + `applyRun`, and wiring `RunningService.logSession` behind the existing feature switch.

**Architecture:** Refactor `ProgressionService.applyGym`'s tail (deltas→upsert→gains→perks→robustness→event→payload, the GYM-agnostic part) into a private `award(createdBy, sourceType, sourceRefId, deltas, kinds, label, durationMin, rpe)`. `applyGym` keeps its GYM head (signal→deltas) and calls `award`. Then `RunSignalCalculator` reads a logged `run_session_log` row + its prescribed session's `kind` (sprint|steady) from the block's jsonb structure to build a `RunSignal`; `ProgressionService.applyRun` maps it to deltas and calls `award`. `RunningService.logSession` computes + attaches `levelUp` behind the same `ProgressionGate`.

**Tech Stack:** Java 21, Spring Boot 4.x, Maven, Hibernate/JPA, PostgreSQL 16, OpenAPI (contract-first), Lombok, AssertJ, JUnit 5.

## Global Constraints

- Base package `io.mrkuhne.mezo`. Driving bd: **mezo-8e4**. Build/test from `backend/`: `./mvnw clean test` (ALWAYS `clean`). Postgres via `docker compose -f backend/compose.yaml up -d` (port 15432).
- **P1 + P2 are shipped (on main).** Reuse: `ProgressionCurve`, `PerkCatalog`, `ProgressionProperties` (`mezo.progression`, with nested `Curve` + `Gym`), `SkillProgressEntity`/repo (`findByCreatedByAndSkillKey`), `LevelUpEventEntity`/repo (`findByCreatedByAndSourceTypeAndSourceRefId`), `PerkUnlockEntity`/repo, `LevelUpResult` (record), `RobustnessCalculator.streakWeeks` (already unions gym+sport+run dates), `ProgressionGate` (`@ConditionalOnProperty`), `LevelUpResultMapper`.
- **`ProgressionService` current shape (P2):** `applyGym` is one `@Transactional` method; its **tail = lines 82–131** (`List<LevelUpResult.Gain> gains = …` through `return payload;`) is the reusable part; the **head = lines 44–80** (idempotency lookup + `GymSignal`→deltas/kinds) is GYM-specific. Helpers `upsert(createdBy,key,kind,delta)`, `levelBefore(cum)`, `resolvePerks(createdBy,key,before,after)` are already family-agnostic. `MILESTONES` is shared; `SOURCE_GYM` is a `private static final String "GYM"`.
- **Skill keys (RUN, from spec §1):** `sprint_speed`, `explosiveness`, `anaerobic_capacity`, `aerobic_capacity`, `strength_endurance` — all kind `ATHLETIC`. Run grants NO muscle XP.
- **RUN signal source = the actual `run_session_log` fields** (`completedRounds`, `durationMin`, `sprintLandmark`, `hrRecoverySec`, `rpeActual`) + the prescribed session's `kind` (sprint|pyramid|steady) read from the `running_block` jsonb structure via `(weekNumber, sessionKey)`. (The spec §2 mentions `distanceM/durationSec`, but the real schema has no distance — use the real fields; note the deviation.) All run-log metric fields except `blockId/weekNumber/sessionKey/date` are NULLABLE — tolerate nulls.
- **Idempotency:** `award` short-circuits if a `level_up_event` exists for `(sourceType, sourceRefId)`. RUN's `sourceRefId` = the saved `run_session_log` id (every POST is a NEW session row, so each genuinely-distinct log grants once; a re-apply of the same saved id is a no-op).
- **Config:** extend the EXISTING `ProgressionProperties` with a nested `Run` record (do NOT create a new `*Properties`); JSR-303 + default in trailing `//` comment; YAML under `mezo.progression`. The robustness rate stays read from `properties.gym().robustness()` for now (cross-family lift is a separate follow-up — do NOT change it here).
- **Service:** `@Service @RequiredArgsConstructor`; method-level `@Transactional` on writes only. **`award` is a private method called inside the public `@Transactional applyGym`/`applyRun`** — it does not carry its own `@Transactional` (it runs in the caller's).
- **Contract-first:** edit `api/feature/train/train.yml` (add optional `levelUp: { $ref: '#/components/schemas/LevelUpResult' }` to `RunSessionLogResponse` — the `LevelUpResult` schema already exists in this fragment from P2; NOT in `required`). Then `cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`, backend regen on `./mvnw clean test`. Commit `api/openapi.yml` + `frontend/src/lib/api.gen.ts` with the fragment. `merge.yml` needs NO edit.
- **Tests:** integration-first, REAL Postgres, no mocks/H2. Service ITs extend `AbstractIntegrationTest` + class `@Transactional`; HTTP ITs extend `ApiIntegrationTest` (use `OwnerProperties`+`databasePopulator.populateUser(ownerProperties.ownerEmail())` for the owner id — there is no `ownerId()` helper). Data via `TrainPopulator`/`RunningPopulator` + `SkillProgressPopulator`. AssertJ; `test{Method}_should{Result}_when{Condition}`. Full `./mvnw clean test` before the slice's final commit.

---

### Task 1: Refactor — extract `award(...)` from `applyGym`'s tail

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java`
- Test: existing `ProgressionServiceIT` (must stay green — behavior-preserving refactor; no new test needed, but verify)

**Interfaces:**
- Produces: `private LevelUpResult award(UUID createdBy, String sourceType, UUID sourceRefId, java.util.Map<String,Long> deltas, java.util.Map<String,String> kinds, String label, Integer durationMin, Integer rpe)` — idempotency-guards on `(sourceType, sourceRefId)`, applies deltas, builds gains/levelUps/perks, runs robustness, writes one `level_up_event`, returns the `LevelUpResult`. `applyGym` keeps the GYM head then `return award(createdBy, SOURCE_GYM, signal.instanceId(), deltas, kinds, "Klasszik kondi", null, null);`.

- [ ] **Step 1: Confirm the current tests are green (baseline)**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionServiceIT`
Expected: PASS (the P2 tests). This is the behavior the refactor must preserve.

- [ ] **Step 2: Read the current `applyGym` and add the `award` method**

Read `ProgressionService.java`. Add `SOURCE_RUN`/`SOURCE_SPORT` constants next to `SOURCE_GYM` (P3a only needs `SOURCE_RUN`, but add it now):

```java
    private static final String SOURCE_GYM = "GYM";
    private static final String SOURCE_RUN = "RUN";
```

Add the new private `award` method — it is the **verbatim tail of the current `applyGym` (lines 82–131)** with the idempotency guard moved to its top and the GYM-specific literals replaced by parameters:

```java
    /**
     * Shared progression tail for every family: idempotent on (sourceType, sourceRefId), applies
     * the per-skill XP deltas, builds gains/level-ups/perks, recomputes streak robustness, writes
     * one level_up_event, and returns the payload. Called inside the caller's @Transactional.
     */
    private LevelUpResult award(UUID createdBy, String sourceType, UUID sourceRefId,
        Map<String, Long> deltas, Map<String, String> kinds, String label,
        Integer durationMin, Integer rpe) {

        var existing = levelUpEventRepository
            .findByCreatedByAndSourceTypeAndSourceRefId(createdBy, sourceType, sourceRefId);
        if (existing.isPresent()) {
            return existing.get().getPayload();
        }

        List<LevelUpResult.Gain> gains = new ArrayList<>();
        List<String> levelUps = new ArrayList<>();
        List<LevelUpResult.Perk> perks = new ArrayList<>();
        long totalXp = 0;
        for (Map.Entry<String, Long> e : deltas.entrySet()) {
            String key = e.getKey();
            long delta = e.getValue();
            totalXp += delta;
            SkillProgressEntity row = upsert(createdBy, key, kinds.get(key), delta);
            int before = levelBefore(row.getCumulativeXp() - delta);
            int after = curve.levelFor(row.getCumulativeXp());
            gains.add(new LevelUpResult.Gain(key, kinds.get(key), key, null, delta, before, after,
                curve.progressPct(row.getCumulativeXp() - delta, before),
                curve.progressPct(row.getCumulativeXp(), after)));
            if (after > before) {
                levelUps.add(key);
                perks.addAll(resolvePerks(createdBy, key, before, after));
            }
        }

        int streak = robustnessCalculator.streakWeeks(createdBy);
        long robustnessTarget = (long) streak * properties.gym().robustness().perWeekXp();
        SkillProgressEntity rob = skillProgressRepository
            .findByCreatedByAndSkillKey(createdBy, "robustness").orElseGet(() -> {
                SkillProgressEntity r = new SkillProgressEntity();
                r.setCreatedBy(createdBy);
                r.setSkillKey("robustness");
                r.setSkillKind("ATHLETIC");
                return r;
            });
        long robustnessDelta = Math.max(0, robustnessTarget - rob.getCumulativeXp());
        rob.setCumulativeXp(robustnessTarget);
        rob.setCurrentLevel(curve.levelFor(robustnessTarget));
        skillProgressRepository.save(rob);
        totalXp += robustnessDelta;

        LevelUpResult payload = new LevelUpResult(sourceType, label, durationMin, rpe, totalXp,
            gains, levelUps, perks, new LevelUpResult.Robustness(robustnessDelta, streak));

        LevelUpEventEntity event = new LevelUpEventEntity();
        event.setCreatedBy(createdBy);
        event.setSourceType(sourceType);
        event.setSourceRefId(sourceRefId);
        event.setTotalXp(totalXp);
        event.setPayload(payload);
        levelUpEventRepository.save(event);

        return payload;
    }
```

- [ ] **Step 3: Replace `applyGym`'s body to call `award`**

`applyGym` keeps its idempotency lookup + GYM head (the `deltas`/`kinds` construction), then delegates the tail. Replace the method so its tail (old lines 82–131) becomes a single `return award(...)`:

```java
    @Transactional
    public LevelUpResult applyGym(UUID createdBy, GymSignal signal) {
        // Build the GYM-specific deltas; award() performs the idempotency guard + shared tail.
        ProgressionProperties.Gym g = properties.gym();
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        signal.volumeByMuscle().forEach((muscle, volume) -> {
            long xp = volume / g.volumeUnit() * g.volumeXpPerUnit();
            if (xp > 0) {
                deltas.merge(muscle, xp, Long::sum);
                kinds.put(muscle, "MUSCLE");
            }
        });
        if (signal.bestE1rm() != null) {
            boolean firstEver = skillProgressRepository
                .findByCreatedByAndSkillKey(createdBy, "max_strength").isEmpty();
            long xp = (long) signal.bestE1rm().intValue() * g.e1rmXpPerKg()
                + (firstEver ? g.prBonusXp() : 0L);
            deltas.merge("max_strength", xp, Long::sum);
            kinds.put("max_strength", "ATHLETIC");
        }
        long enduranceXp = (long) signal.workSetCount() * g.strengthEnduranceXpPerSet()
            + (long) signal.bodyweightRepCount() * g.bodyweightXpPerRep();
        if (enduranceXp > 0) {
            deltas.merge("strength_endurance", enduranceXp, Long::sum);
            kinds.put("strength_endurance", "ATHLETIC");
        }

        return award(createdBy, SOURCE_GYM, signal.instanceId(), deltas, kinds,
            "Klasszik kondi", null, null);
    }
```

> **Implementer note:** the GYM idempotency was previously *before* the head (lines 45–50). Now `award` guards at its top — but `applyGym`'s head does a `skillProgressRepository.findByCreatedByAndSkillKey(... "max_strength")` read (the firstEver check) before `award` guards. That read is harmless on a re-apply (no write happens until `award`, which then short-circuits). The behavior is preserved: a re-applied gym instance still returns the stored payload with no double-write. If you prefer to keep the guard strictly first, you may add an early `award`-style lookup in `applyGym` too — but it is not required; verify `ProgressionServiceIT.testApplyGym_shouldBeIdempotent` stays green.

- [ ] **Step 4: Run the existing tests to verify the refactor preserved behavior**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionServiceIT`
Expected: PASS — all P2 `applyGym` tests (XP math, idempotency, level-up, PR rule) still green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java
git commit -m "refactor(progression): extract shared award() tail from applyGym (mezo-8e4)"
```

---

### Task 2: Run config + `RunSignal` + `RunSignalCalculator`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java` (add nested `Run`)
- Modify: `backend/src/main/resources/application.yml` (add `mezo.progression.run`)
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/run/RunSignal.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/run/RunSignalCalculator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/run/RunSignalCalculatorIT.java`

**Interfaces:**
- Produces: `ProgressionProperties.run()` → `Run(Integer sprintXpPerRound, Integer anaerobicXpPerRound, Integer steadyXpPerMin, Integer aerobicXpPerMin, Integer rpeXpPerPoint, Integer hrRecoveryBonusXp)`. `RunSignal(UUID logId, String kind, Integer completedRounds, Integer durationMin, Integer rpeActual, String sprintLandmark, Integer hrRecoverySec)` (record). `RunSignalCalculator.compute(UUID createdBy, UUID runLogId) → RunSignal` — resolves the prescribed session `kind` (sprint|pyramid|steady; default "steady") from the block structure.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression.run;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class RunSignalCalculatorIT extends AbstractIntegrationTest {

    @Autowired private RunSignalCalculator calculator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private RunSessionLogRepository logRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testCompute_shouldResolveSprintKindAndFields_whenLoggedAgainstASprintSession() {
        UUID user = databasePopulator.populateUser("run@test.local");
        // RunningPopulator builds a block whose structure has a session keyed "w1-sprint" of kind "sprint".
        RunningBlockEntity block = runningPopulator.createSprintBlock(user);
        RunSessionLogEntity log = runningPopulator.createRunLog(
            user, block.getId(), 1, "w1-sprint", LocalDate.parse("2026-06-22"),
            6, 8, 75, "200m", 32); // completedRounds=6, rpe=8, hrRecovery=75, landmark=200m, durationMin=32

        RunSignal signal = calculator.compute(user, log.getId());

        assertThat(signal.logId()).isEqualTo(log.getId());
        assertThat(signal.kind()).isEqualTo("sprint");
        assertThat(signal.completedRounds()).isEqualTo(6);
        assertThat(signal.rpeActual()).isEqualTo(8);
        assertThat(signal.durationMin()).isEqualTo(32);
        assertThat(signal.sprintLandmark()).isEqualTo("200m");
    }

    @Test
    void testCompute_shouldDefaultToSteady_whenPrescribedSessionKindMissing() {
        UUID user = databasePopulator.populateUser("steady@test.local");
        RunningBlockEntity block = runningPopulator.createSprintBlock(user);
        RunSessionLogEntity log = runningPopulator.createRunLog(
            user, block.getId(), 1, "no-such-key", LocalDate.parse("2026-06-22"),
            null, 5, null, null, 45);

        RunSignal signal = calculator.compute(user, log.getId());

        assertThat(signal.kind()).isEqualTo("steady"); // unknown sessionKey → default steady
        assertThat(signal.durationMin()).isEqualTo(45);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=RunSignalCalculatorIT`
Expected: FAIL — `RunSignalCalculator`/`RunSignal` don't exist, and `RunningPopulator.createSprintBlock`/`createRunLog` may not exist (add them in Step 3).

- [ ] **Step 3: Add the populator factories the test needs**

Read `backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java` to confirm the real `RunningBlockEntity`/`RunSessionLogEntity` setters + the `RunningBlockStructure` shape. Add a sprint-block factory (with a `w1-sprint` prescribed session of kind `sprint`) and a run-log factory. Adapt the structure construction to the REAL `RunningBlockStructure` record (weeks → sessions → `RunPrescribedSession(key, dayOfWeek, timeOfDay, label, kind, rpeTarget, rounds, segments)`):

```java
    public RunningBlockEntity createSprintBlock(UUID createdBy) {
        RunningBlockEntity b = new RunningBlockEntity();
        b.setCreatedBy(createdBy);
        b.setTitle("Sprint blokk");
        b.setGoal("sprint");
        b.setKind("interval");
        b.setStatus("active");
        b.setWeeks(4);
        b.setCurrentWeek(1);
        // RunningBlockStructure(weeks) → RunWeek(weekNumber, phaseLabel, sessions)
        //   → RunPrescribedSession(key, dayOfWeek, timeOfDay, label, kind, RpeTarget(min,max), rounds, segments)
        //   → RunSegment(type, durationSec, label). (Add `import ...entity.RunningBlockStructure;`.)
        b.setStructure(new RunningBlockStructure(List.of(
            new RunningBlockStructure.RunWeek(1, "MEV", List.of(
                new RunningBlockStructure.RunPrescribedSession(
                    "w1-sprint", 1, null, "Sprint", "sprint",
                    new RunningBlockStructure.RpeTarget(8, 9), 6,
                    List.of(new RunningBlockStructure.RunSegment("work", 30, "Sprint"))))))));
        return runningBlockRepository.saveAndFlush(b);
    }

    public RunSessionLogEntity createRunLog(UUID createdBy, UUID blockId, int weekNumber,
        String sessionKey, java.time.LocalDate date, Integer completedRounds, Integer rpeActual,
        Integer hrRecoverySec, String sprintLandmark, Integer durationMin) {
        RunSessionLogEntity e = new RunSessionLogEntity();
        e.setCreatedBy(createdBy);
        e.setBlockId(blockId);
        e.setWeekNumber(weekNumber);
        e.setSessionKey(sessionKey);
        e.setDate(date);
        e.setCompletedRounds(completedRounds);
        e.setRpeActual(rpeActual);
        e.setHrRecoverySec(hrRecoverySec);
        e.setSprintLandmark(sprintLandmark);
        e.setDurationMin(durationMin);
        return runSessionLogRepository.saveAndFlush(e);
    }
```

> **Implementer note:** the `RunningBlockStructure` is a nested jsonb record tree — READ `RunningBlockStructure.java` for the exact `weeks`/`sessions` nesting (the scan saw `RunPrescribedSession(key, dayOfWeek, timeOfDay, label, kind, rpeTarget, rounds, segments)` and `RunSegment(type, durationSec, label)` but not the week wrapper). Build the smallest valid structure with one week holding the `w1-sprint` session of kind `sprint`. If `RunningPopulator` already has block/log factories, reuse/extend them instead of duplicating; ensure the injected repositories exist on the populator.

- [ ] **Step 4: Add the `Run` config + YAML**

In `ProgressionProperties.java`, add a `run` component + nested `Run` record (keep `curve`, `gym`):

```java
    @NotNull @Valid Run run
```
```java
    /** Run-path XP weights (sprint: rounds/RPE/landmark; steady: minutes + HR-recovery). */
    public record Run(
        @NotNull @PositiveOrZero Integer sprintXpPerRound,    // 25 (sprint_speed per completed round)
        @NotNull @PositiveOrZero Integer anaerobicXpPerRound, // 15 (anaerobic_capacity per round)
        @NotNull @PositiveOrZero Integer steadyXpPerMin,      // 4 (strength_endurance per minute)
        @NotNull @PositiveOrZero Integer aerobicXpPerMin,     // 5 (aerobic_capacity per minute)
        @NotNull @PositiveOrZero Integer rpeXpPerPoint,       // 6 (explosiveness/effort per RPE point)
        @NotNull @PositiveOrZero Integer hrRecoveryBonusXp    // 30 (aerobic bonus when HR-recovery logged)
    ) {}
```

In `application.yml`, under `mezo.progression`:

```yaml
    # Run-path XP weights.
    run:
      sprint-xp-per-round: 25     # sprint_speed per completed sprint round
      anaerobic-xp-per-round: 15  # anaerobic_capacity per completed sprint round
      steady-xp-per-min: 4        # strength_endurance per steady minute
      aerobic-xp-per-min: 5       # aerobic_capacity per steady minute
      rpe-xp-per-point: 6         # explosiveness / effort proxy per RPE point
      hr-recovery-bonus-xp: 30    # one-off aerobic bonus when HR-recovery is logged
```

- [ ] **Step 5: Write `RunSignal`**

```java
// RunSignal.java
package io.mrkuhne.mezo.feature.progression.run;

import java.util.UUID;

/**
 * Progression-relevant signal from one logged run session. kind (sprint|pyramid|steady) comes from
 * the prescribed session in the block structure; the metric fields are the logged actuals (any may
 * be null). pyramid is treated as sprint for scoring.
 */
public record RunSignal(
    UUID logId,
    String kind,
    Integer completedRounds,
    Integer durationMin,
    Integer rpeActual,
    String sprintLandmark,
    Integer hrRecoverySec
) {}
```

- [ ] **Step 6: Write `RunSignalCalculator`**

```java
// RunSignalCalculator.java
package io.mrkuhne.mezo.feature.progression.run;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Builds a RunSignal from a logged run session + its prescribed session's kind (sprint|steady). */
@Component
@RequiredArgsConstructor
public class RunSignalCalculator {

    private static final String DEFAULT_KIND = "steady";

    private final RunSessionLogRepository runSessionLogRepository;
    private final RunningBlockRepository runningBlockRepository;

    public RunSignal compute(UUID createdBy, UUID runLogId) {
        RunSessionLogEntity log = runSessionLogRepository.findById(runLogId).orElseThrow();
        String kind = resolveKind(createdBy, log.getBlockId(), log.getSessionKey());
        return new RunSignal(log.getId(), kind, log.getCompletedRounds(), log.getDurationMin(),
            log.getRpeActual(), log.getSprintLandmark(), log.getHrRecoverySec());
    }

    /** The prescribed session's kind from the block's jsonb structure; "steady" if not found. */
    private String resolveKind(UUID createdBy, UUID blockId, String sessionKey) {
        RunningBlockEntity block = runningBlockRepository.findById(blockId).orElse(null);
        if (block == null || block.getStructure() == null) {
            return DEFAULT_KIND;
        }
        RunningBlockStructure structure = block.getStructure();
        // Walk weeks → sessions; match the prescribed session by key, return its kind.
        // (Adapt the traversal to the real RunningBlockStructure nesting.)
        return structure.weeks().stream()
            .flatMap(w -> w.sessions().stream())
            .filter(s -> sessionKey.equals(s.key()))
            .map(RunningBlockStructure.RunPrescribedSession::kind)
            .findFirst()
            .orElse(DEFAULT_KIND);
    }
}
```

> **Implementer note:** the traversal is VERIFIED against `RunningBlockStructure.java`: `weeks()` → `List<RunWeek>`, `RunWeek.sessions()` → `List<RunPrescribedSession>`, `RunPrescribedSession.key()`/`.kind()` — the code above is correct as written. Only confirm the repository bean name is `RunningBlockRepository` and that `RunningBlockEntity.getStructure()` returns the typed `RunningBlockStructure` (jsonb). Add the `RunningBlockStructure` import.

- [ ] **Step 7: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=RunSignalCalculatorIT`
Expected: PASS (2 tests). **Also fix the `ProgressionCurveTest` constructor call** — it builds `ProgressionProperties` directly, so it now needs a THIRD `Run` arg: `new ProgressionProperties(new Curve(100, 1.6), <existing Gym literal>, new Run(25, 15, 4, 5, 6, 30))`. (`ProgressionPropertiesIT` `@Autowires` the bean, so it is unaffected — though you may add `properties.run()` assertions to it.) Run `-Dtest=ProgressionCurveTest` to confirm it still compiles + passes.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/run backend/src/main/java/io/mrkuhne/mezo/feature/progression/config/ProgressionProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/support/populator/RunningPopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/progression/run/RunSignalCalculatorIT.java
git commit -m "feat(progression): run config + RunSignal calculator (sprint/steady) (mezo-8e4)"
```

---

### Task 3: `ProgressionService.applyRun`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionRunIT.java`

**Interfaces:**
- Consumes: `RunSignal` (Task 2), `ProgressionProperties.Run` (Task 2), `award` (Task 1).
- Produces: `ProgressionService.applyRun(UUID createdBy, RunSignal signal) → LevelUpResult` — idempotent on `(RUN, signal.logId())`; SPRINT/pyramid → `sprint_speed` (rounds), `anaerobic_capacity` (rounds), `explosiveness` (RPE); STEADY → `aerobic_capacity` (min + HR bonus), `strength_endurance` (min). All `ATHLETIC`.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.progression.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpResult;
import io.mrkuhne.mezo.feature.progression.run.RunSignal;
import io.mrkuhne.mezo.feature.progression.repository.SkillProgressRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ProgressionRunIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private SkillProgressRepository skillProgressRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testApplyRun_shouldGrantSprintSkills_whenSprintSession() {
        UUID user = databasePopulator.populateUser("sprint@test.local");
        UUID logId = UUID.randomUUID();
        // sprint: 6 rounds → sprint_speed 6*25=150, anaerobic 6*15=90; rpe 8 → explosiveness 8*6=48
        RunSignal signal = new RunSignal(logId, "sprint", 6, 32, 8, "200m", null);

        LevelUpResult result = progressionService.applyRun(user, signal);

        assertThat(result.source()).isEqualTo("RUN");
        assertThat(result.durationMin()).isEqualTo(32);
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(150L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "anaerobic_capacity"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(90L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "explosiveness"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(48L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "aerobic_capacity")).isEmpty();
    }

    @Test
    void testApplyRun_shouldGrantSteadySkills_whenSteadySession() {
        UUID user = databasePopulator.populateUser("steady2@test.local");
        UUID logId = UUID.randomUUID();
        // steady: 45 min → strength_endurance 45*4=180, aerobic 45*5=225 + HR bonus 30 = 255
        RunSignal signal = new RunSignal(logId, "steady", null, 45, 6, null, 80);

        LevelUpResult result = progressionService.applyRun(user, signal);

        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "strength_endurance"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(180L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "aerobic_capacity"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(255L));
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed")).isEmpty();
    }

    @Test
    void testApplyRun_shouldBeIdempotent_whenSameLogAppliedTwice() {
        UUID user = databasePopulator.populateUser("runidem@test.local");
        UUID logId = UUID.randomUUID();
        RunSignal signal = new RunSignal(logId, "sprint", 4, 20, 7, null, null);

        LevelUpResult first = progressionService.applyRun(user, signal);
        LevelUpResult second = progressionService.applyRun(user, signal);

        assertThat(second.totalXp()).isEqualTo(first.totalXp());
        assertThat(skillProgressRepository.findByCreatedByAndSkillKey(user, "sprint_speed"))
            .get().satisfies(s -> assertThat(s.getCumulativeXp()).isEqualTo(100L)); // 4*25 once
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionRunIT`
Expected: FAIL — `applyRun` doesn't exist.

- [ ] **Step 3: Write `applyRun`**

Add to `ProgressionService` (uses `award` from Task 1, `properties.run()` from Task 2):

```java
    @Transactional
    public LevelUpResult applyRun(UUID createdBy, RunSignal signal) {
        ProgressionProperties.Run r = properties.run();
        Map<String, Long> deltas = new LinkedHashMap<>();
        Map<String, String> kinds = new LinkedHashMap<>();

        boolean sprint = "sprint".equals(signal.kind()) || "pyramid".equals(signal.kind());
        if (sprint) {
            int rounds = signal.completedRounds() != null ? signal.completedRounds() : 0;
            addAthletic(deltas, kinds, "sprint_speed", (long) rounds * r.sprintXpPerRound());
            addAthletic(deltas, kinds, "anaerobic_capacity", (long) rounds * r.anaerobicXpPerRound());
            if (signal.rpeActual() != null) {
                addAthletic(deltas, kinds, "explosiveness",
                    (long) signal.rpeActual() * r.rpeXpPerPoint());
            }
        } else { // steady (default)
            int min = signal.durationMin() != null ? signal.durationMin() : 0;
            addAthletic(deltas, kinds, "strength_endurance", (long) min * r.steadyXpPerMin());
            long aerobic = (long) min * r.aerobicXpPerMin()
                + (signal.hrRecoverySec() != null ? r.hrRecoveryBonusXp() : 0L);
            addAthletic(deltas, kinds, "aerobic_capacity", aerobic);
        }

        String label = sprint ? "Sprint futás" : "Futás";
        return award(createdBy, SOURCE_RUN, signal.logId(), deltas, kinds,
            label, signal.durationMin(), signal.rpeActual());
    }

    /** Add an ATHLETIC delta only when positive (keeps the payload free of 0-XP gains). */
    private void addAthletic(Map<String, Long> deltas, Map<String, String> kinds, String key, long xp) {
        if (xp > 0) {
            deltas.merge(key, xp, Long::sum);
            kinds.put(key, "ATHLETIC");
        }
    }
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=ProgressionRunIT`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/progression/service/ProgressionService.java backend/src/test/java/io/mrkuhne/mezo/feature/progression/service/ProgressionRunIT.java
git commit -m "feat(progression): applyRun (sprint/steady XP) (mezo-8e4)"
```

---

### Task 4: Wire `RunningService.logSession` → `applyRun` (behind the switch) + contract

**Files:**
- Modify: `api/feature/train/train.yml` (add optional `levelUp` to `RunSessionLogResponse`)
- Modify (regenerated, committed): `api/openapi.yml`, `frontend/src/lib/api.gen.ts`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/RunningService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/RunSessionLevelUpApiIT.java`

**Interfaces:**
- Consumes: `RunSignalCalculator.compute` (Task 2), `ProgressionService.applyRun` (Task 3), `LevelUpResultMapper.toDto`, `ProgressionGate` (P2), the generated `RunSessionLogResponse.setLevelUp(...)`.

- [ ] **Step 1: Add `levelUp` to the run response schema + regenerate**

In `api/feature/train/train.yml`, add to `RunSessionLogResponse.properties` (NOT to `required`):

```yaml
        levelUp:
          $ref: '#/components/schemas/LevelUpResult'
```

Run:
```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```
Verify `grep -c 'levelUp' api/openapi.yml` increased (RunSessionLogResponse now carries it).

- [ ] **Step 2: Write the failing contract IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

class RunSessionLevelUpApiIT extends ApiIntegrationTest {

    @Autowired private RunningPopulator runningPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testLogRunSession_shouldReturnLevelUp_whenSprintSessionLogged() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        RunningBlockEntity block = runningPopulator.createSprintBlock(owner);

        RunSessionLogResponse body = postForBody("/api/train/run-sessions",
            Map.of("blockId", block.getId().toString(), "weekNumber", 1,
                "sessionKey", "w1-sprint", "date", "2026-06-22",
                "completedRounds", 6, "rpeActual", 8, "durationMin", 32),
            ownerAuthHeaders(), HttpStatus.CREATED, RunSessionLogResponse.class);

        assertThat(body.getLevelUp()).isNotNull();
        assertThat(body.getLevelUp().getSource())
            .isEqualTo(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.RUN);
        assertThat(body.getLevelUp().getGains())
            .anySatisfy(g -> assertThat(g.getSkillKey()).isEqualTo("sprint_speed"));
    }
}
```

> **Implementer note:** confirm the `postForBody(path, body, headers, status, type)` signature + that `ownerAuthHeaders()`/the demodata owner setup matches the P2 `WorkoutFinishLevelUpApiIT` (copy its owner-id approach). The POST body shape must match `RunSessionLogRequest` field names (blockId/weekNumber/sessionKey/date/completedRounds/rpeActual/durationMin). Adapt if a field name differs.

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest=RunSessionLevelUpApiIT`
Expected: FAIL — `getLevelUp()` is null (wiring absent).

- [ ] **Step 4: Wire `RunningService.logSession`**

Mirror the gym wiring (P2 `WorkoutService`). Add the collaborators (the class is `@RequiredArgsConstructor` — add `private final` fields) and attach `levelUp` behind the gate:

```java
    private final io.mrkuhne.mezo.feature.progression.run.RunSignalCalculator runSignalCalculator;
    private final io.mrkuhne.mezo.feature.progression.service.ProgressionService progressionService;
    private final io.mrkuhne.mezo.feature.progression.mapper.LevelUpResultMapper levelUpResultMapper;
    private final org.springframework.beans.factory.ObjectProvider<
        io.mrkuhne.mezo.feature.progression.ProgressionGate> progressionGate;
```

```java
    @Transactional
    public RunSessionLogResponse logSession(UUID userId, RunSessionLogRequest req) {
        requireOwned(userId, req.getBlockId());
        RunSessionLogEntity e = new RunSessionLogEntity();
        e.setCreatedBy(userId);
        e.setBlockId(req.getBlockId());
        e.setWeekNumber(req.getWeekNumber());
        e.setSessionKey(req.getSessionKey());
        e.setDate(req.getDate());
        e.setCompletedRounds(req.getCompletedRounds());
        e.setRpeActual(req.getRpeActual());
        e.setHrRecoverySec(req.getHrRecoverySec());
        e.setSprintLandmark(req.getSprintLandmark());
        e.setDurationMin(req.getDurationMin());
        e.setNotes(req.getNotes());
        RunSessionLogResponse base = mapper.toResponse(logRepository.save(e));
        // progression only when the feature switch is on; atomic with the save; applyRun is
        // idempotent on the saved log id.
        if (progressionGate.getIfAvailable() != null) {
            var signal = runSignalCalculator.compute(userId, e.getId());
            base.setLevelUp(levelUpResultMapper.toDto(progressionService.applyRun(userId, signal)));
        }
        return base;
    }
```

> **Implementer note:** confirm `RunSessionLogResponse` exposes `setLevelUp(...)` after regen (plain `@lombok.Builder` DTO — the setter exists, as P2 confirmed for `WorkoutInstanceResponse`). Keep `mapper.toResponse(...)` as the base build; attach `levelUp` only here (the GET list path does not run this). Verify the existing field names on `RunSessionLogRequest`.

- [ ] **Step 5: Run to verify it passes**

Run: `cd backend && ./mvnw clean test -Dtest=RunSessionLevelUpApiIT`
Expected: PASS — the run log POST returns a populated `levelUp` (RUN source, sprint_speed gain).

- [ ] **Step 6: Full-suite regression gate**

Run: `cd backend && ./mvnw clean test`
Expected: ALL green. The `award` refactor preserved gym behavior; the new run wiring is additive; existing run-log tests still pass (`levelUp` is an added optional field, and progression only runs behind the switch which is `true` in `application.yml`).

- [ ] **Step 7: Commit**

```bash
git add api/feature/train/train.yml api/openapi.yml frontend/src/lib/api.gen.ts backend/src/main/java/io/mrkuhne/mezo/feature/train/service/RunningService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/RunSessionLevelUpApiIT.java
git commit -m "feat(progression): wire run log → applyRun + levelUp contract (mezo-8e4)"
```

---

## P3a → P3b handoff

P3a leaves `award(...)` as the shared multi-family tail and a working RUN path. **P3b (sport path + cross/TRX generalization)** adds: the sport-session generalization (a `kind` discriminator VOLLEYBALL|CROSS|TRX + general-effort fields like `rounds` on `sport_session` — new Liquibase migration + entity/DTO/contract changes, relaxing the volleyball-required `setsPlayed`/`shoulderStrain`), a `SportSignal` + `SportSignalCalculator` (branching on kind per spec §1), `ProgressionService.applySport` (reusing `award`), and the `SportService.logSportSession` wiring + `levelUp` on `SportSessionResponse`. P4 then adds `GET /api/progression/profile`.

## Self-review notes

- Spec coverage (P3a = the RUN portion of spec §8 P3): `award` refactor (the P2-review recommendation) ✓(T1); RunSignal incl. sprint/steady kind from the prescribed session ✓(T2); applyRun mapping per §1 (sprint→sprint_speed/anaerobic/explosiveness; steady→aerobic/strength_endurance) ✓(T3); run trigger + contract levelUp ✓(T4). Robustness reused unchanged (gym-rate, lift deferred). Sport + cross/TRX deliberately deferred to P3b.
- Type consistency: `award` (T1) consumed by `applyGym` (T1) + `applyRun` (T3). `RunSignal` (T2) consumed by `applyRun` (T3) + `RunningService` (T4). `ProgressionProperties.Run` (T2) used in `applyRun` (T3).
- Known deviations flagged inline: spec §2's `distanceM/durationSec` replaced by real run-log fields (no distance in schema); robustness rate still read from `properties.gym().robustness()` (cross-family config lift deferred); pyramid kind scored as sprint.
- Implementer must verify before coding: the `RunningBlockStructure` week/session nesting (T2 traversal), `RunningPopulator`/`RunningBlockRepository` real names (T2), `RunSessionLogResponse.setLevelUp` + `RunSessionLogRequest` field names + `postForBody`/owner-id helper (T4).
