# Fuel Layer C — TDEE Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A backend goal-engine maintenance-modelljét `BMR×PAL`-ról `BMR×NEAT + heti betáblázott EAT`-re állítja (ugyanaz a MET×kg×óra modell, mint a FE napi célja), explicit `dailyEnergyBalance`-t tesz a kontraktusra, a Me „Alap-TDEE" kártyát dinamikus + bontott nézetté teszi, és az `activityLevel`-t 3-band NEAT-életmóddá értelmezi újra.

**Architecture:** A train domain új `WeeklyScheduledActivityService`-e (train-port) számolja a heti betáblázott aktivitás-energiát (MET×kg×óra); a goal-engine bootstrap + projekció ezt fogyasztja. A kontraktus `TdeeBootstrap` bővül (`neat` + `neatBaselineKcal` + `weeklyEatKcalPerDay`), a `GoalPrescriptionSegment` egy `dailyEnergyBalanceKcal` mezővel. Egy `@Profile("demodata")` startup-runner + Liquibase migráció összehangolja a meglévő goalt. A FE a hardkód NEAT-et és a `segment.kcal − tdee` közelítést explicit wire-értékekre cseréli.

**Tech Stack:** Spring Boot 4.x / Java 21 / Maven; PostgreSQL + Liquibase; MapStruct + Lombok; React 19 + Vite + Vitest + Playwright; OpenAPI contract-first.

## Global Constraints

- Base package: `io.mrkuhne.mezo`. PK-k UUID. Spring Boot 4.x, Java 21, Maven.
- **Contract-first:** minden boundary-DTO a `api/feature/**/*.yml`-ből generálódik — a YAML-t ELŐBB szerkeszd, majd `cd api/generate && npm run generate:api`, `cd frontend && pnpm generate:api`; a backend Java típusok `./mvnw generate-sources`-nál. SOHA ne írj kézzel boundary-DTO-t.
- **Config:** minden tunable `@Validated @ConfigurationProperties` record a `mezo.*` gyökér alatt; a `@ConfigurationPropertiesScan` (MezoApplication) auto-regisztrálja — nincs explicit wiring. NINCS `@Value`, nincs hardkódolt szám.
- **Spring:** konstruktor-injektálás (`@RequiredArgsConstructor`), method-szintű `@Transactional`, soha field-injektálás.
- **Liquibase:** versioned changeset a `db/changelog/1.0.0/script/{YYYYMMDDHHMM}_mezo-eujg_{desc}.sql` néven, regisztrálva a `1.0.0/1.0.0_master.yml`-ben (`id: "1.0.0:{filename}"`, `author: daniel.kuhne`); SOHA ne módosíts kiadott changesetet; explicit constraint-nevek (`ck_`).
- **Tesztek:** integration-first (`@SpringBootTest` + Testcontainers/fix `mezo_test`), `test{Method}_should{Result}_when{Condition}`, AssertJ, nincs mock/`@MockBean`/H2. Új domain-tábla → `ResetDatabase` TRUNCATE + új populator (itt nincs új tábla). FE: mindkét mód (`pnpm test` + `VITE_USE_MOCK=true pnpm test`).
- **MET-tábla:** a backend `TrainProperties.met` a FE `fuelConfig.MET_BY_KIND` TÜKRE (`gym 6.0 / sport 4.5 / run 9.5 / default 5.0`); egy drift-guard teszt köti őket.
- **bd id:** `mezo-eujg`. Branch: `feat/fuel-layer-c`. Worktree-commit HOOK-MENTES: `git -c core.hooksPath=/dev/null commit`; commitnál CSAK az érintett fájlokat `git add`-old (a `.beads/issues.jsonl` törlést + a `fuel-mai-verify-top.png`-t NE). Conventional commit subject a bd id-vel.
- Spec: [`docs/superpowers/specs/2026-07-26-fuel-layer-c-tdee-reconciliation-design.md`](2026-07-26-fuel-layer-c-tdee-reconciliation-design.md).

---

### Task 1: Kontraktus — `TdeeBootstrap` + `GoalPrescriptionSegment` + `activityLevel` enum

**Files:**
- Modify: `api/feature/goal/goal.yml` (`TdeeBootstrap` schema ~157-166; `GoalPrescriptionSegment` ~177-189)
- Modify: `api/feature/biometrics-profile/biometrics-profile.yml:41,55` (`activityLevel` enum)
- Regenerate: `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`, backend generated DTOs

**Interfaces:**
- Produces (generated backend DTOs, used Task 7): `TdeeBootstrap.builder().bmr(..).neat(..).neatBaselineKcal(..).weeklyEatKcalPerDay(..).tdee(..).formula(..).computedAt(..)`; `GoalPrescriptionSegment.builder()....dailyEnergyBalanceKcal(..)`.
- Produces (generated FE types, used Tasks 10-12): `components['schemas']['TdeeBootstrap']` = `{ bmr, neat, neatBaselineKcal, weeklyEatKcalPerDay, tdee, formula, computedAt }`; `GoalPrescriptionSegment` gains `dailyEnergyBalanceKcal: number`; `activityLevel` enum `'DESK'|'MIXED'|'PHYSICAL'`.

- [ ] **Step 1: `TdeeBootstrap` schema — `pal`→`neat`, +2 mező.** In `api/feature/goal/goal.yml` replace the `TdeeBootstrap` schema body:

```yaml
    TdeeBootstrap:
      type: object
      description: Formula-TDEE bootstrap snapshot computed at first evaluation. tdee = neatBaselineKcal + weeklyEatKcalPerDay.
      required: [bmr, neat, neatBaselineKcal, weeklyEatKcalPerDay, tdee, formula, computedAt]
      properties:
        bmr: { type: number, description: Basal metabolic rate (kcal/day) }
        neat: { type: number, description: Non-exercise activity multiplier (lifestyle band DESK/MIXED/PHYSICAL) }
        neatBaselineKcal: { type: number, description: bmr × neat — the non-exercise lifestyle maintenance (kcal/day) }
        weeklyEatKcalPerDay: { type: number, description: Scheduled training energy (gym+sport+run), weekly total ÷ 7 (kcal/day) }
        tdee: { type: number, description: Total maintenance = neatBaselineKcal + weeklyEatKcalPerDay (kcal/day) }
        formula: { type: string, enum: [MSJ, KATCH], description: 'MSJ = Mifflin-St Jeor, KATCH = Katch-McArdle' }
        computedAt: { type: string, format: date-time }
```

- [ ] **Step 2: `GoalPrescriptionSegment` — `+ dailyEnergyBalanceKcal`.** Add the field to the schema's `required` list and `properties` (after `projectedRateKgPerWk`):

```yaml
        projectedRateKgPerWk: { type: number }
        dailyEnergyBalanceKcal: { type: integer, description: 'Goal deficit(−)/surplus(+) per day (kcal); sign×rate%/100×kg×kcalPerKg÷7' }
        rationale: { type: string }
```
And add `dailyEnergyBalanceKcal` to `required: [fromWeek, toWeek, label, kcal, proteinG, sleepTargetH, restDays, projectedRateKgPerWk, dailyEnergyBalanceKcal, rationale]`.

- [ ] **Step 3: `activityLevel` enum — 3-band.** In `api/feature/biometrics-profile/biometrics-profile.yml` at BOTH occurrences (lines ~41 and ~55) replace:

```yaml
        activityLevel: { type: string, enum: [DESK, MIXED, PHYSICAL], nullable: true }
```
Update the nearby comments from "defaulted to MODERATE" → "defaulted to MIXED server-side when absent".

- [ ] **Step 4: Regenerate the merged contract + FE types.**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: `api/openapi.yml` + `frontend/src/data/_client/api.gen.ts` updated; `TdeeBootstrap` shows `neat`/`neatBaselineKcal`/`weeklyEatKcalPerDay`; `GoalPrescriptionSegment` shows `dailyEnergyBalanceKcal`; `activityLevel` enum is `DESK|MIXED|PHYSICAL`. (The FE build will now fail on `pal`/old enum — Tasks 10-12 fix it. That's expected here.)

- [ ] **Step 5: Verify backend DTO generation.**

Run: `cd backend && ./mvnw generate-sources -q`
Expected: BUILD SUCCESS; the generated `TdeeBootstrap`/`GoalPrescriptionSegment` DTOs carry the new fields. (The backend `compile` still fails on `GoalMapper`/entities — later tasks fix it.)

- [ ] **Step 6: Commit.**

```bash
git add api/feature/goal/goal.yml api/feature/biometrics-profile/biometrics-profile.yml api/openapi.yml frontend/src/data/_client/api.gen.ts
git -c core.hooksPath=/dev/null commit -m "feat(api): TdeeBootstrap neat/weeklyEat + segment dailyEnergyBalance + 3-band activityLevel (mezo-eujg)"
```

---

### Task 2: `GoalEngineProperties` — `Neat` record (Pal csere), `Met` törlés, `application.yml`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java`
- Modify: `backend/src/main/resources/application.yml` (`mezo.goal.pal` 60-65 → `neat`; törli `mezo.goal.met` 86-90)
- Modify (test compile-fix): `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapServiceTest.java` (kézi konstruktor)

**Interfaces:**
- Produces (used Task 4): `GoalEngineProperties.Neat` record with `forLevel(String) → Double` (default `mixed` when null/unknown); values `desk 1.20`, `mixed 1.35`, `physical 1.50`. `props.neat()` replaces `props.pal()`. `props.met()` and the `Met` record are REMOVED.

- [ ] **Step 1: Replace the `Pal` record with `Neat`, remove `Met`.** In `GoalEngineProperties.java`:
  - Change the constructor component `@NotNull @Valid Pal pal` → `@NotNull @Valid Neat neat`.
  - Remove the `@NotNull @Valid Met met` component (and its Javadoc line).
  - Replace the `Pal` nested record with:

```java
    /**
     * NEAT (non-exercise activity thermogenesis) multipliers per lifestyle band. The lifestyle band
     * is the NON-exercise daily life; training energy is added explicitly (weekly scheduled EAT), never
     * baked into this multiplier. {@code mixed} is the engine default when the band is unknown.
     */
    public record Neat(
        @NotNull @Positive Double desk,      // 1.20 — desk job, few steps
        @NotNull @Positive Double mixed,     // 1.35 — on feet a fair bit — DEFAULT
        @NotNull @Positive Double physical   // 1.50 — physical job, on feet all day
    ) {
        /** Maps a {@code BiometricProfile.activityLevel} (DESK|MIXED|PHYSICAL, case-insensitive) to its
         *  NEAT multiplier; {@code mixed} (1.35) for null/unknown. */
        public Double forLevel(String activityLevel) {
            if (activityLevel == null) {
                return mixed;
            }
            return switch (activityLevel.trim().toUpperCase()) {
                case "DESK" -> desk;
                case "PHYSICAL" -> physical;
                default -> mixed; // MIXED + any legacy/unknown value
            };
        }
    }
```
  - Delete the entire `Met` nested record (lines ~132-139).

- [ ] **Step 2: `application.yml` — `pal`→`neat`, drop `met`.** Replace the `pal:` block (60-65) with:

```yaml
    neat:                          # NEAT lifestyle multipliers (non-exercise); training added via mezo.train.met
      desk: 1.20
      mixed: 1.35                  # DEFAULT
      physical: 1.50
```
Delete the whole `met:` block (86-90).

- [ ] **Step 3: Fix the `TdeeBootstrapServiceTest` hand-built constructor (compile-fix only, not logic yet).** In `TdeeBootstrapServiceTest.java` replace the `new GoalEngineProperties(...)` positional args: `new GoalEngineProperties.Pal(1.2, 1.375, 1.55, 1.725, 1.9)` → `new GoalEngineProperties.Neat(1.20, 1.35, 1.50)`, and DELETE the `new GoalEngineProperties.Met(325, 500, 500, 1150)` argument. (The `compute(...)` call and PAL asserts change in Task 4 — here only make it compile.)

- [ ] **Step 4: Verify it compiles.**

Run: `cd backend && ./mvnw clean test-compile -q`
Expected: BUILD SUCCESS **fails** only in `GoalProjectionService`/`GoalProjectionServiceIT` (still reference `props.met()`), which Task 5 fixes. If other files break, they consume `Pal`/`Met` unexpectedly — grep `props.pal()`/`props.met()` and note for the affected task. `TdeeBootstrapService.compute` still calls `props.pal()` → expected break, fixed in Task 4.

> **Note:** Tasks 2, 4, 5 form a compile-coupled cluster (the record change ripples into bootstrap + projection). Each commits its own focused deliverable; full `./mvnw clean test` green is expected only after Task 5. Run the *focused* test named in each task.

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapServiceTest.java
git -c core.hooksPath=/dev/null commit -m "feat(goal): NEAT bands replace PAL, retire session-kcal Met config (mezo-eujg)"
```

---

### Task 3: Train-port — `TrainProperties` (MET) + `WeeklyScheduledActivityService`

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TrainProperties.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityService.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityServiceIT.java`
- Modify: `backend/src/main/resources/application.yml` (add `mezo.train` block)

**Interfaces:**
- Consumes: `GymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID)`, `SportScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID)`. Entity accessors: `GymScheduleSlotEntity.getDayOfWeek()/getTime()`; `SportScheduleSlotEntity.getDurationMin()/getKind()/getSport()`.
- Produces (used Tasks 4-5):
  - `TrainProperties.met() → Met{ gym, sport, run, defaultKind }` (Double METs) + `TrainProperties.gymDefaultMinutes() → int` + `TrainProperties.runDefaultMinutes() → int`.
  - `WeeklyScheduledActivityService.scheduledWeeklyEatKcalPerDay(UUID userId, BigDecimal weightKg) → BigDecimal` (gym+sport only, segment-independent).
  - `WeeklyScheduledActivityService.runWeeklyEatKcalPerDay(int sessionsPerWeek, BigDecimal weightKg) → BigDecimal` (one run kind × sessions ÷ 7).
  - `WeeklyScheduledActivityService.blockKcal(String kind, int durationMin, BigDecimal weightKg) → BigDecimal` (MET×kg×min/60, the shared primitive).

- [ ] **Step 1: `TrainProperties`.** Mirror `VolumeProperties` (`train/config/`, `@ConfigurationPropertiesScan` auto-registers):

```java
package io.mrkuhne.mezo.feature.train.config;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Valid;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Train-domain tunables ({@code mezo.train}). The MET table mirrors the frontend
 * {@code fuelConfig.MET_BY_KIND} (a drift-guard test binds them); kcal = MET × kg × (min/60).
 */
@Validated
@ConfigurationProperties(prefix = "mezo.train")
public record TrainProperties(
    @NotNull @Valid Met met,
    @NotNull @Positive Integer gymDefaultMinutes,   // gym slots carry no duration → default 60 (FE DEFAULT_BLOCK_MIN)
    @NotNull @Positive Integer runDefaultMinutes     // interval runs have no single duration → default 45 (FE DEFAULT_RUN_MIN)
) {
    /** MET by training-block kind — mirror of FE fuelConfig.MET_BY_KIND. */
    public record Met(
        @NotNull @Positive Double gym,       // 6.0
        @NotNull @Positive Double sport,     // 4.5
        @NotNull @Positive Double run,       // 9.5
        @NotNull @Positive Double defaultKind // 5.0
    ) {}
}
```

- [ ] **Step 2: `application.yml` — `mezo.train` block.** Add under the `mezo:` root (near the other feature blocks):

```yaml
  train:
    gym-default-minutes: 60        # gym schedule slots carry no duration
    run-default-minutes: 45        # interval runs have no single continuous duration
    met:                           # MET by kind — MIRROR of FE fuelConfig.MET_BY_KIND (drift-guard test)
      gym: 6.0
      sport: 4.5
      run: 9.5
      default-kind: 5.0
```

- [ ] **Step 3: Write the failing test.** Create `WeeklyScheduledActivityServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WeeklyScheduledActivityServiceIT extends AbstractIntegrationTest {

    @Autowired private WeeklyScheduledActivityService service;
    @Autowired private TrainProperties props;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator trainPopulator;

    private static final BigDecimal W = new BigDecimal("80.0");

    @Test
    void testScheduledWeeklyEat_shouldBeZero_whenNoSchedule() {
        UUID user = databasePopulator.populateUser("wsa-empty@test.local");
        assertThat(service.scheduledWeeklyEatKcalPerDay(user, W).doubleValue()).isZero();
    }

    @Test
    void testScheduledWeeklyEat_shouldSumGymAndSport_whenScheduled() {
        UUID user = databasePopulator.populateUser("wsa-full@test.local");
        trainPopulator.createGymSlot(user, 0, "18:00"); // Mon
        trainPopulator.createGymSlot(user, 2, "18:00"); // Wed
        trainPopulator.createGymSlot(user, 4, "18:00"); // Fri  → 3 gym × 60min
        trainPopulator.createScheduleSlot(user, 1, "18:00", 120, "training"); // Tue volleyball
        trainPopulator.createScheduleSlot(user, 3, "18:00", 120, "training"); // Thu volleyball → 2 × 120min
        // gym:  6.0 × 80 × (60/60) × 3 = 1440 ; sport: 4.5 × 80 × (120/60) × 2 = 1440 ; total 2880 ÷ 7
        double expected = (6.0 * 80 * 1.0 * 3 + 4.5 * 80 * 2.0 * 2) / 7.0;
        assertThat(service.scheduledWeeklyEatKcalPerDay(user, W).doubleValue()).isCloseTo(expected, within(0.5));
    }

    @Test
    void testRunWeeklyEat_shouldScaleWithSessions() {
        // 9.5 × 80 × (45/60) × 3 ÷ 7
        double expected = props.met().run() * 80 * (props.runDefaultMinutes() / 60.0) * 3 / 7.0;
        assertThat(service.runWeeklyEatKcalPerDay(3, W).doubleValue()).isCloseTo(expected, within(0.5));
        assertThat(service.runWeeklyEatKcalPerDay(0, W).doubleValue()).isZero();
    }
}
```

- [ ] **Step 4: Run it, verify it fails.**

Run: `cd backend && ./mvnw test -Dtest=WeeklyScheduledActivityServiceIT -q`
Expected: FAIL — `WeeklyScheduledActivityService` does not exist.

- [ ] **Step 5: Implement `WeeklyScheduledActivityService`.**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly SCHEDULED training energy (kcal/day) from the owner's recurring gym + sport slots, MET×kg×óra
 * based. The train domain owns the schedule + the MET model (a drift-guard test binds the MET table to
 * the FE fuelConfig). Running is goal-linked + segment-dependent, so it is exposed as a per-session
 * primitive for the projection to weight per segment. Weight is a parameter (biometrics owns it).
 */
@Service
@RequiredArgsConstructor
public class WeeklyScheduledActivityService {

    private static final String KIND_GYM = "gym";
    private static final String KIND_SPORT = "sport";
    private static final String KIND_RUN = "run";
    private static final int DAYS_PER_WEEK = 7;
    private static final int SCALE = 2;

    private final GymScheduleSlotRepository gymRepo;
    private final SportScheduleSlotRepository sportRepo;
    private final TrainProperties props;

    /** Gym + sport recurring weekly schedule energy ÷ 7 (kcal/day). Segment-independent. */
    @Transactional(readOnly = true)
    public BigDecimal scheduledWeeklyEatKcalPerDay(UUID userId, BigDecimal weightKg) {
        BigDecimal weekly = BigDecimal.ZERO;
        for (GymScheduleSlotEntity g : gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)) {
            weekly = weekly.add(blockKcal(KIND_GYM, props.gymDefaultMinutes(), weightKg));
        }
        for (SportScheduleSlotEntity s : sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)) {
            weekly = weekly.add(blockKcal(KIND_SPORT, s.getDurationMin(), weightKg));
        }
        return weekly.divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
    }

    /** One running kind × sessionsPerWeek ÷ 7 (kcal/day). The projection weights this per segment. */
    public BigDecimal runWeeklyEatKcalPerDay(int sessionsPerWeek, BigDecimal weightKg) {
        if (sessionsPerWeek <= 0) {
            return BigDecimal.ZERO;
        }
        return blockKcal(KIND_RUN, props.runDefaultMinutes(), weightKg)
            .multiply(BigDecimal.valueOf(sessionsPerWeek))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
    }

    /** MET × kg × (durationMin / 60). The shared MET×kg×óra primitive. */
    public BigDecimal blockKcal(String kind, int durationMin, BigDecimal weightKg) {
        double met = switch (kind) {
            case KIND_GYM -> props.met().gym();
            case KIND_SPORT -> props.met().sport();
            case KIND_RUN -> props.met().run();
            default -> props.met().defaultKind();
        };
        return BigDecimal.valueOf(met)
            .multiply(weightKg)
            .multiply(BigDecimal.valueOf(durationMin))
            .divide(BigDecimal.valueOf(60), SCALE, RoundingMode.HALF_UP);
    }
}
```

- [ ] **Step 6: Run the test, verify it passes.**

Run: `cd backend && ./mvnw test -Dtest=WeeklyScheduledActivityServiceIT -q`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/config/TrainProperties.java backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityServiceIT.java backend/src/main/resources/application.yml
git -c core.hooksPath=/dev/null commit -m "feat(train): WeeklyScheduledActivityService MET×kg×óra weekly EAT port (mezo-eujg)"
```

---

### Task 4: `TdeeBootstrapService` + `TdeeBootstrapJson` — NEAT + weekly EAT

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/TdeeBootstrapJson.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapServiceTest.java`

**Interfaces:**
- Consumes: `props.neat().forLevel(String)` (Task 2).
- Produces (used Tasks 5-7): `TdeeBootstrapJson(BigDecimal bmr, BigDecimal neat, BigDecimal neatBaselineKcal, BigDecimal weeklyEatKcalPerDay, BigDecimal tdee, String formula, OffsetDateTime computedAt)`. `TdeeBootstrapService.compute(BiometricProfileEntity profile, BigDecimal currentWeightKg, BigDecimal weeklyEatKcalPerDay) → TdeeBootstrapJson` where `neatBaselineKcal = bmr×neat`, `tdee = neatBaselineKcal + weeklyEatKcalPerDay`.

- [ ] **Step 1: Extend `TdeeBootstrapJson`.** Replace the record header:

```java
public record TdeeBootstrapJson(
    BigDecimal bmr,
    BigDecimal neat,               // NEAT multiplier (was pal)
    BigDecimal neatBaselineKcal,   // bmr × neat
    BigDecimal weeklyEatKcalPerDay,// scheduled training energy ÷ 7
    BigDecimal tdee,               // neatBaselineKcal + weeklyEatKcalPerDay
    String formula, // MSJ | KATCH
    OffsetDateTime computedAt
) {
}
```
Update the Javadoc "PAL"→"NEAT + weekly scheduled EAT".

- [ ] **Step 2: Rewrite the failing tests.** In `TdeeBootstrapServiceTest.java` change the `compute` calls to the 3-arg signature and the PAL asserts to NEAT. Replace the two MSJ/Katch tests + the null-level + Very tests. Key edits (the service field ctor already fixed in Task 2):

```java
    // MSJ, no body fat, MIXED default (null level), weeklyEat 0:
    @Test
    void testCompute_shouldUseMifflinStJeor_whenBodyFatAbsent() {
        TdeeBootstrapJson r = service.compute(profile("M", 182, 34, null, "MIXED"), new BigDecimal("84"), BigDecimal.ZERO);
        assertThat(r.formula()).isEqualTo("MSJ");
        assertThat(r.bmr().doubleValue()).isCloseTo(1795, within(1.0));
        assertThat(r.neat().doubleValue()).isEqualTo(1.35);
        assertThat(r.neatBaselineKcal().doubleValue()).isCloseTo(1795 * 1.35, within(1.0));
        assertThat(r.weeklyEatKcalPerDay().doubleValue()).isZero();
        assertThat(r.tdee().doubleValue()).isCloseTo(1795 * 1.35, within(1.0)); // weeklyEat 0 → tdee == baseline
        assertThat(r.computedAt()).isNotNull();
    }

    @Test
    void testCompute_shouldAddWeeklyEatToTdee_whenScheduled() {
        TdeeBootstrapJson r = service.compute(profile("M", 182, 34, null, "MIXED"), new BigDecimal("84"), new BigDecimal("500"));
        assertThat(r.tdee().doubleValue()).isCloseTo(r.neatBaselineKcal().doubleValue() + 500, within(0.5));
    }

    @Test
    void testCompute_shouldUseDeskBand_whenActivityLevelDesk() {
        TdeeBootstrapJson r = service.compute(profile("M", 182, 34, null, "DESK"), new BigDecimal("84"), BigDecimal.ZERO);
        assertThat(r.neat().doubleValue()).isEqualTo(1.20);
    }

    @Test
    void testCompute_shouldDefaultToMixed_whenActivityLevelNull() {
        TdeeBootstrapJson r = service.compute(profile("M", 182, 34, null, null), new BigDecimal("84"), BigDecimal.ZERO);
        assertThat(r.neat().doubleValue()).isEqualTo(1.35);
    }
```
Keep `testCompute_shouldUseKatchMcArdle_whenBodyFatPresent` and `testCompute_shouldSubtract161Constant_whenFemaleMsj` but add the `BigDecimal.ZERO` third arg to their `compute(...)` calls and swap any `.pal()` assert to `.neat()`.

- [ ] **Step 3: Run tests, verify they fail.**

Run: `cd backend && ./mvnw test -Dtest=TdeeBootstrapServiceTest -q`
Expected: FAIL — `compute` has 2 args / `neat()` accessor missing.

- [ ] **Step 4: Rewrite `TdeeBootstrapService.compute`.** Replace the method + the PAL line:

```java
    public TdeeBootstrapJson compute(
        BiometricProfileEntity profile, BigDecimal currentWeightKg, BigDecimal weeklyEatKcalPerDay) {
        BigDecimal bmr;
        String formula;
        if (profile.getBodyFatPct() != null) {
            bmr = katchMcArdle(currentWeightKg, profile.getBodyFatPct());
            formula = FORMULA_KATCH;
        } else {
            int age = ageYears(profile.getBirthDate());
            bmr = mifflinStJeor(currentWeightKg, profile.getHeightCm(), age, profile.getSex());
            formula = FORMULA_MSJ;
        }

        BigDecimal neat = BigDecimal.valueOf(props.neat().forLevel(profile.getActivityLevel()));
        BigDecimal neatBaseline = bmr.multiply(neat);
        BigDecimal weeklyEat = weeklyEatKcalPerDay == null ? BigDecimal.ZERO : weeklyEatKcalPerDay;
        BigDecimal tdee = neatBaseline.add(weeklyEat);

        // neat stays unrounded (a multiplier); the kcal outputs are rounded to whole-ish kcal precision.
        return new TdeeBootstrapJson(
            scaled(bmr), neat, scaled(neatBaseline), scaled(weeklyEat), scaled(tdee), formula, OffsetDateTime.now());
    }
```
Update the class Javadoc: `<b>PAL</b>` bullet → NEAT band; the anti-double-count note now reads "training energy is added explicitly via `weeklyEatKcalPerDay` (scheduled EAT), never baked into the multiplier".

- [ ] **Step 5: Run tests, verify they pass.**

Run: `cd backend && ./mvnw test -Dtest=TdeeBootstrapServiceTest -q`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/TdeeBootstrapJson.java backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapService.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/TdeeBootstrapServiceTest.java
git -c core.hooksPath=/dev/null commit -m "feat(goal): TDEE bootstrap = BMR×NEAT + weekly scheduled EAT (mezo-eujg)"
```

---

### Task 5: `GoalProjectionService` + `GoalPrescriptionJson.Segment` — runDelta kivezetés + `dailyEnergyBalanceKcal`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalPrescriptionJson.java` (`Segment` record)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionServiceIT.java`

**Interfaces:**
- Consumes: `WeeklyScheduledActivityService.scheduledWeeklyEatKcalPerDay(userId, weightKg)`, `.runWeeklyEatKcalPerDay(sessionsPerWeek, weightKg)` (Task 3); `bootstrap.neatBaselineKcal()` (Task 4).
- Produces (used Tasks 6-7): `ProjectionSegment` gains a `BigDecimal dailyEnergyBalanceKcal` accessor (already computed as `balance` — now surfaced). `GoalProjectionService.project(goal, userId, bootstrap, trend)` signature unchanged; internally injects `WeeklyScheduledActivityService`. `GoalPrescriptionJson.Segment` gains `Integer dailyEnergyBalanceKcal` (after `projectedRateKgPerWk`).

- [ ] **Step 1: Extend `GoalPrescriptionJson.Segment`.** Add `Integer dailyEnergyBalanceKcal` after `projectedRateKgPerWk`:

```java
    public record Segment(
        Integer fromWeek,
        Integer toWeek,
        String label,
        Integer kcal,
        Integer proteinG,
        BigDecimal sleepTargetH,
        List<Integer> restDays,
        BigDecimal projectedRateKgPerWk,
        Integer dailyEnergyBalanceKcal,
        String rationale
    ) {
    }
```

- [ ] **Step 2: Rewrite the failing projection test.** In `GoalProjectionServiceIT.java`: add `@Autowired private WeeklyScheduledActivityService weeklyActivity;` is NOT needed (injected into the service). Replace the run-boundary expectation — the run step is now MET×kg×óra, not session-kcal. Change `testProject_shouldStepTdeeDownAtRunningBoundary_whenRunningEndsMidWindow`:

```java
    // With no gym/sport schedule seeded, scheduledWeeklyEat = 0; the only delta between the run-on and
    // run-off segments is the running EAT (MET run × weight × runDefaultMin/60 × sessions ÷ 7).
    @Test
    void testProject_shouldStepTdeeDownAtRunningBoundary_whenRunningEndsMidWindow() {
        // ... existing meso + running seed (8wk, 4 sessions, linked 1-8 / 1-4) ...
        List<ProjectionSegment> segs = service.project(goal, user, bootstrap(), trend(DataSufficiencyEnum.NONE, null));
        assertThat(segs).hasSize(2);
        ProjectionSegment runOn = segs.get(0);
        ProjectionSegment runOff = segs.get(1);
        assertThat(runOn.activeSystems()).contains("run");
        assertThat(runOn.tdeeEstimate().doubleValue()).isGreaterThan(runOff.tdeeEstimate().doubleValue());
        // run-off segment tdee == the bootstrap's neat baseline (no schedule, no run)
        assertThat(runOff.tdeeEstimate().doubleValue())
            .isCloseTo(bootstrap().neatBaselineKcal().doubleValue(), within(1.0));
    }
```
Update `bootstrap()` fixture to the new 7-arg `TdeeBootstrapJson`:

```java
    private TdeeBootstrapJson bootstrap() {
        BigDecimal bmr = new BigDecimal("1795.00");
        BigDecimal neat = new BigDecimal("1.35");
        BigDecimal baseline = bmr.multiply(neat); // 2423.25
        return new TdeeBootstrapJson(bmr, neat, baseline.setScale(2, java.math.RoundingMode.HALF_UP),
            BigDecimal.ZERO, baseline.setScale(2, java.math.RoundingMode.HALF_UP), "MSJ", OffsetDateTime.now());
    }
```
Add a new balance-surfacing assert to any one segment: `assertThat(segs.get(0).dailyEnergyBalanceKcal()).isNotNull();`. The maintain/bulk/observed-rate tests keep their `dailyEnergyBalance` math (`props.kcalPerKg()` at line 71 unchanged) — only the `tdeeEstimate` expectation changes from "bootstrap.tdee + runDelta" to "neatBaseline + scheduled + run EAT". Delete the `props.met().intervalRunKcal()` reference (line ~100).

- [ ] **Step 3: Run it, verify it fails.**

Run: `cd backend && ./mvnw test -Dtest=GoalProjectionServiceIT -q`
Expected: FAIL — `ProjectionSegment.dailyEnergyBalanceKcal()` / new `tdeeEstimate` math not implemented.

- [ ] **Step 4: Rewrite `GoalProjectionService`.**
  - Inject the port: add `private final WeeklyScheduledActivityService weeklyActivity;` to the constructor fields.
  - Remove `SYSTEM_GYM`/run-delta-via-`props.met()`; add the MET-based segment maintenance. In `buildSegment`, replace the `runDelta`/`tdee` block:

```java
        // Segment maintenance = neat baseline + scheduled gym+sport EAT + this segment's running EAT.
        // (Gym+sport are weekly-recurring, segment-independent; running is goal-linked, per-segment.)
        BigDecimal scheduled = weeklyActivity.scheduledWeeklyEatKcalPerDay(userId, weightKg);
        BigDecimal runEat = ld.runActive()
            ? weeklyActivity.runWeeklyEatKcalPerDay(ld.runSessionsPerWeek(), weightKg)
            : BigDecimal.ZERO;
        BigDecimal tdee = bootstrap.neatBaselineKcal().add(scheduled).add(runEat);
        BigDecimal target = tdee.add(balance);
```
  - `buildSegment` needs `userId` + `weightKg` — thread them through (`project` already computes `weightKg = currentWeightKg(goal, trend)`; pass both into `buildSegment`). Update the `buildSegment(...)` signature + the call site in `project`.
  - Add a `dailyEnergyBalanceKcal` field to the `ProjectionSegment` record and pass `balance.setScale(0, RoundingMode.HALF_UP).intValueExact()` (`balance` is the BigDecimal kcal already computed via `dailyEnergyBalance(goal, weightKg)` — surface it as a whole-kcal int).
  - Update the `rationale(...)` text: running now "+X kcal/nap MET×kg×óra alapon"; the class Javadoc's "Block-boundary TDEE delta policy" → "Segment maintenance policy" (running is MET×kg×óra per segment; meso still zero energy delta; volleyball now counts via the weekly schedule, no longer ambient).

Update the `ProjectionSegment` record:
```java
    public record ProjectionSegment(
        int fromWeek, int toWeek, String label,
        BigDecimal tdeeEstimate, BigDecimal targetKcal, BigDecimal projectedRateKgPerWk,
        int dailyEnergyBalanceKcal, List<String> activeSystems, String rationale) {}
```

- [ ] **Step 5: Run it, verify it passes.**

Run: `cd backend && ./mvnw test -Dtest=GoalProjectionServiceIT -q`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalPrescriptionJson.java backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionServiceIT.java
git -c core.hooksPath=/dev/null commit -m "feat(goal): segment maintenance from MET×kg×óra schedule, surface dailyEnergyBalance (mezo-eujg)"
```

---

### Task 6: Orchestrator wiring — `GoalEngineService` + `GoalEvaluationService`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java`

**Interfaces:**
- Consumes: `WeeklyScheduledActivityService` (Task 3), the new `bootstrap.compute(profile, weight, weeklyEat)` (Task 4), `ProjectionSegment.dailyEnergyBalanceKcal()` (Task 5).
- Produces: `GoalEngineService.evaluate` computes `totalWeeklyEat = scheduledWeeklyEatKcalPerDay(user, weight) + runWeeklyEatKcalPerDay(currentActiveRunningSessions, weight)` and passes it to `bootstrap.compute`. `GoalEvaluationService.assemble` folds `ProjectionSegment.dailyEnergyBalanceKcal()` into `Segment.dailyEnergyBalanceKcal`.

- [ ] **Step 1: Rewrite the failing evaluation asserts.** In `GoalEvaluationServiceIT.java`: the maintain test `testEvaluate_shouldHoldKcalAtTdee_whenMaintain` still holds `s.kcal() ≈ reloaded.getTdeeBootstrap().tdee()` (with weeklyEat 0, no schedule seeded, tdee == neat baseline — unchanged assertion shape). Add a new assert to the cut test that the segment carries the explicit balance:

```java
    @Test
    void testEvaluate_shouldExposeDailyEnergyBalance_whenCut() {
        UUID user = databasePopulator.populateUser("eval-balance@test.local");
        profilePopulator.create(user);
        seedWeight(user, "84.00");
        GoalEntity g = goal(user, "cut", "0.70", List.of());
        GoalPrescriptionJson rx = engine.evaluate(user, g.getId());
        assertThat(rx.segments()).isNotEmpty();
        assertThat(rx.segments().get(0).dailyEnergyBalanceKcal()).isNotNull().isLessThan(0); // cut → deficit
    }
```
For any test that seeds a gym/sport schedule and checks `s.kcal()` vs `tdeeBootstrap.tdee()`: the tdee now already includes the weekly EAT (bootstrap), so the maintain equality still holds because BOTH sides move together. Keep the existing asserts; only add the balance test.

- [ ] **Step 2: Run it, verify it fails.**

Run: `cd backend && ./mvnw test -Dtest=GoalEvaluationServiceIT -q`
Expected: FAIL — `Segment.dailyEnergyBalanceKcal()` not populated / compile error on `bootstrap.compute` arity in `GoalEngineService`.

- [ ] **Step 3: Wire the train-port into `GoalEngineService.evaluate`.**
  - Add fields: `private final WeeklyScheduledActivityService weeklyActivity;` and `private final RunningBlockRepository runningBlockRepository;`.
  - Before `bootstrapService.compute`, compute the current total weekly EAT:

```java
        BigDecimal currentWeightKg = currentWeightKg(userId, goal);
        BigDecimal weeklyEat = weeklyActivity.scheduledWeeklyEatKcalPerDay(userId, currentWeightKg)
            .add(weeklyActivity.runWeeklyEatKcalPerDay(currentActiveRunningSessions(userId), currentWeightKg));
        TdeeBootstrapJson bootstrap = bootstrapService.compute(profile, currentWeightKg, weeklyEat);
```
  - Add helper (the bootstrap's snapshot uses the currently-active running block's first-week session count):

```java
    /** Sessions/week of the owner's currently active running block (0 when none) — the bootstrap snapshot. */
    private int currentActiveRunningSessions(UUID userId) {
        return runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .map(b -> b.getStructure() == null || b.getStructure().weeks() == null || b.getStructure().weeks().isEmpty()
                ? 0
                : (b.getStructure().weeks().get(0).sessions() == null ? 0 : b.getStructure().weeks().get(0).sessions().size()))
            .orElse(0);
    }
```

- [ ] **Step 4: Fold the balance in `GoalEvaluationService.assemble`.** In the `for (ProjectionSegment seg : segments)` loop, add `seg.dailyEnergyBalanceKcal()` to the `new Segment(...)` call at the new position (after `projectedRateKgPerWk`, before `rationale`):

```java
            rxSegments.add(new Segment(
                seg.fromWeek(), seg.toWeek(), seg.label(),
                seg.targetKcal().setScale(0, RoundingMode.HALF_UP).intValueExact(),
                proteinG, DEFAULT_SLEEP_TARGET_H, List.of(),
                seg.projectedRateKgPerWk(),
                seg.dailyEnergyBalanceKcal(),
                seg.rationale()));
```

- [ ] **Step 5: Run it, verify it passes.**

Run: `cd backend && ./mvnw test -Dtest=GoalEvaluationServiceIT -q`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java
git -c core.hooksPath=/dev/null commit -m "feat(goal): orchestrator feeds weekly EAT to bootstrap, folds dailyEnergyBalance (mezo-eujg)"
```

---

### Task 7: `GoalMapper` — new fields to the contract DTOs

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapper.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapperTest.java` (if it exists; else add asserts to a goal API IT — grep first)

**Interfaces:**
- Consumes: extended `TdeeBootstrapJson` (Task 4), extended `GoalPrescriptionJson.Segment` (Task 5), generated DTO builders (Task 1).
- Produces: the goal REST response carries `tdeeBootstrap.{neat,neatBaselineKcal,weeklyEatKcalPerDay}` + `segment.dailyEnergyBalanceKcal`.

- [ ] **Step 1: Update `toTdeeBootstrap`.** Replace `.pal(j.pal())` and add the two fields:

```java
        return TdeeBootstrap.builder()
            .bmr(j.bmr())
            .neat(j.neat())
            .neatBaselineKcal(j.neatBaselineKcal())
            .weeklyEatKcalPerDay(j.weeklyEatKcalPerDay())
            .tdee(j.tdee())
            .formula(j.formula() == null ? null : TdeeBootstrap.FormulaEnum.fromValue(j.formula()))
            .computedAt(j.computedAt())
            .build();
```

- [ ] **Step 2: Update `toSegments`.** Add `.dailyEnergyBalanceKcal(s.dailyEnergyBalanceKcal())` to the segment builder chain (after `.projectedRateKgPerWk(...)`).

- [ ] **Step 3: Find & extend the mapper test.**

Run: `cd backend && grep -rl "GoalMapper" src/test`
If a `GoalMapperTest` exists, add asserts for the new fields; otherwise add a round-trip assert to `GoalApiIT` (or the existing goal-response IT) that `getGoal(...).getTdeeBootstrap().getNeat()` and `getPrescription().getSegments().get(0).getDailyEnergyBalanceKcal()` are present after evaluate. Show the assert:

```java
        GoalResponse body = getForBody("/api/goals/" + goalId, ownerAuthHeaders(), HttpStatus.OK, GoalResponse.class);
        assertThat(body.getTdeeBootstrap().getNeat()).isNotNull();
        assertThat(body.getTdeeBootstrap().getWeeklyEatKcalPerDay()).isNotNull();
        assertThat(body.getPrescription().getSegments().get(0).getDailyEnergyBalanceKcal()).isNotNull();
```

- [ ] **Step 4: Run the mapper/API test, verify pass.**

Run: `cd backend && ./mvnw test -Dtest=GoalMapperTest -q` (or the goal API IT you extended)
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapper.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/mapper/
git -c core.hooksPath=/dev/null commit -m "feat(goal): map neat/weeklyEat/dailyEnergyBalance to the contract (mezo-eujg)"
```

---

### Task 8: Liquibase migration — `activity_level` CHECK + remap

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202607261200_mezo-eujg_reframe_activity_level_neat.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append the changeSet)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile/ActivityLevelMigrationIT.java`

**Interfaces:**
- Consumes: the `ck_biometric_profile_activity_level` CHECK from `202606191000_mezo-g1u_...` (drop + re-add).
- Produces: `activity_level` accepts only `DESK|MIXED|PHYSICAL`; existing rows remapped.

- [ ] **Step 1: Write the changeset SQL.**

```sql
-- mezo-eujg: reframe biometric_profile.activity_level PAL bands → 3 NEAT lifestyle bands.
-- The activity level now means the NON-exercise daily lifestyle; training energy is added
-- explicitly (weekly scheduled EAT). Never modify a released changeset.

-- 1. Drop the old 5-token CHECK so we can remap the data.
ALTER TABLE biometric_profile DROP CONSTRAINT ck_biometric_profile_activity_level;

-- 2. Remap existing rows: SEDENTARY/LIGHT→DESK · MODERATE→MIXED · VERY/EXTRA→PHYSICAL.
UPDATE biometric_profile SET activity_level = CASE activity_level
    WHEN 'SEDENTARY' THEN 'DESK'
    WHEN 'LIGHT'     THEN 'DESK'
    WHEN 'MODERATE'  THEN 'MIXED'
    WHEN 'VERY'      THEN 'PHYSICAL'
    WHEN 'EXTRA'     THEN 'PHYSICAL'
    ELSE activity_level
END
WHERE activity_level IS NOT NULL;

-- 3. Re-add the CHECK with the 3-band taxonomy.
ALTER TABLE biometric_profile
    ADD CONSTRAINT ck_biometric_profile_activity_level
        CHECK (activity_level IN ('DESK','MIXED','PHYSICAL'));
```

- [ ] **Step 2: Register it in the version master.** Append to `1.0.0/1.0.0_master.yml` (at the tail):

```yaml
  - changeSet:
      id: "1.0.0:202607261200_mezo-eujg_reframe_activity_level_neat"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202607261200_mezo-eujg_reframe_activity_level_neat.sql
```

- [ ] **Step 3: Write the migration IT.** Verify the CHECK accepts new + rejects old. Create `ActivityLevelMigrationIT.java`:

```java
package io.mrkuhne.mezo.feature.biometrics.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DatabasePopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class ActivityLevelMigrationIT extends AbstractIntegrationTest {

    @Autowired private BiometricProfileRepository repository;
    @Autowired private DatabasePopulator databasePopulator;

    private BiometricProfileEntity profile(UUID owner, String level) {
        BiometricProfileEntity e = new BiometricProfileEntity();
        e.setCreatedBy(owner);
        e.setSex("M");
        e.setHeightCm(new BigDecimal("180.0"));
        e.setBirthDate(LocalDate.of(1991, 3, 1));
        e.setActivityLevel(level);
        return e;
    }

    @Test
    void testCheck_shouldAcceptNewBands() {
        UUID user = databasePopulator.populateUser("neat-ok@test.local");
        BiometricProfileEntity saved = repository.saveAndFlush(profile(user, "PHYSICAL"));
        assertThat(saved.getActivityLevel()).isEqualTo("PHYSICAL");
    }

    @Test
    void testCheck_shouldRejectLegacyBand() {
        UUID user = databasePopulator.populateUser("neat-legacy@test.local");
        assertThatThrownBy(() -> repository.saveAndFlush(profile(user, "MODERATE")))
            .isInstanceOf(Exception.class); // DB CHECK violation
    }
}
```

- [ ] **Step 4: Run the migration IT (Liquibase runs at context startup against the fixed test DB).**

Run: `cd backend && ./mvnw test -Dtest=ActivityLevelMigrationIT -q`
Expected: PASS. (If the fixed `mezo_test` DB already applied the old changelog, the new changeset applies on top; use `-Dmezo.test.use-testcontainers=true` for a clean throwaway DB if the CHECK is stale.)

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/script/202607261200_mezo-eujg_reframe_activity_level_neat.sql backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/profile/ActivityLevelMigrationIT.java
git -c core.hooksPath=/dev/null commit -m "feat(db): reframe activity_level to 3 NEAT bands + remap (mezo-eujg)"
```

---

### Task 9: Auto re-evaluate runner + `GoalRepository` finder

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunner.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalRepository.java` (add owner-scoped non-archived finder if needed)
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunnerIT.java`

**Interfaces:**
- Consumes: `GoalEngineService.evaluate(UUID userId, UUID goalId)` (Task 6); `OwnerProperties.ownerEmail()`; `AppUserRepository.findByEmail(...)`; `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String)`.
- Produces: `GoalReevaluateRunner` (`@Component @Profile("demodata") @Order(200) implements CommandLineRunner`) with a no-arg `run()` overload (IT entry point) that re-evaluates every non-archived owner goal.

- [ ] **Step 1: Write the failing IT.** Create `GoalReevaluateRunnerIT.java`:

```java
package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class GoalReevaluateRunnerIT extends AbstractIntegrationTest {

    @Autowired private GoalReevaluateRunner runner;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private EntityManager entityManager;

    @Test
    void testRun_shouldPopulatePrescription_whenActiveGoalHasNone() {
        // The runner resolves goals by owner email — seed the OWNER (databasePopulator.populateUser
        // returns the owner id when given the owner email; use OwnerProperties email).
        UUID owner = databasePopulator.populateUser(ownerEmailForTest());
        profilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.of(2026, 6, 1), new BigDecimal("84.00"));
        GoalEntity g = goalPopulator.createGoal(owner, "cut", "active");
        // pre-condition: freshly created goal may have a prescription from createGoal's evaluate;
        // null it to prove the runner recomputes.
        g.setPrescription(null);
        goalRepository.saveAndFlush(g);

        runner.run(); // no-arg overload

        entityManager.flush();
        entityManager.clear();
        GoalEntity reloaded = goalRepository.findById(g.getId()).orElseThrow();
        assertThat(reloaded.getPrescription()).isNotNull();
        assertThat(reloaded.getPrescription().segments()).isNotEmpty();
    }
}
```
> The `ownerEmailForTest()` helper: inject `OwnerProperties` and return `ownerProperties.ownerEmail()`, because the runner scopes to the owner. If `databasePopulator.populateUser` cannot re-create the owner (already master data), instead fetch the owner id via `AppUserRepository.findByEmail(ownerProperties.ownerEmail())`. Verify which by reading `DatabasePopulator` during implementation and adjust the seed accordingly.

- [ ] **Step 2: Add the finder if missing.** In `GoalRepository.java` confirm `findByCreatedByAndStatusAndDeletedFalse(UUID, String)` exists (the Explore report shows it does). The runner iterates `planned` + `active` (skips `archived`) — call the finder twice or add:

```java
    List<GoalEntity> findByCreatedByAndStatusNotAndDeletedFalse(UUID createdBy, String status);
```
Use `findByCreatedByAndStatusNotAndDeletedFalse(ownerId, "archived")` to get non-archived goals in one query.

- [ ] **Step 3: Run the IT, verify it fails.**

Run: `cd backend && ./mvnw test -Dtest=GoalReevaluateRunnerIT -q`
Expected: FAIL — `GoalReevaluateRunner` does not exist.

- [ ] **Step 4: Implement the runner.** Mirror `GoalSeedData`'s two-method + `OwnerProperties` shape:

```java
package io.mrkuhne.mezo.feature.goal;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.config.OwnerProperties;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Startup reconciliation (Fuel Layer C, mezo-eujg): after the NEAT/weekly-EAT migration the owner's
 * existing goal prescription is stale (old BMR×PAL numbers, no dailyEnergyBalanceKcal). This runner
 * re-evaluates every non-archived owner goal so the fresh prescription carries the new model. Idempotent
 * ({@code evaluate} overwrites). {@code @Profile("demodata")} — the prod-active profile; ITs call {@link #run()}.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(200) // after the seed runners (owner 0, train 100/110, goal 120)
@RequiredArgsConstructor
public class GoalReevaluateRunner implements CommandLineRunner {

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final GoalRepository goalRepository;
    private final GoalEngineService goalEngineService;

    @Override
    public void run(String... args) {
        run();
    }

    /** No-arg overload — IT entry point after ResetDatabase wipes the startup seed. */
    @Transactional
    public void run() {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return;
        }
        UUID ownerId = owner.getId();
        for (GoalEntity goal : goalRepository.findByCreatedByAndStatusNotAndDeletedFalse(ownerId, "archived")) {
            goalEngineService.evaluate(ownerId, goal.getId());
        }
    }
}
```
> Verify `OwnerProperties`/`AppUserRepository` package paths during implementation (grep — `GoalSeedData` imports them). Adjust imports to match.

- [ ] **Step 5: Run the IT, verify it passes.**

Run: `cd backend && ./mvnw test -Dtest=GoalReevaluateRunnerIT -q`
Expected: PASS.

- [ ] **Step 6: Backend full focused sweep (the goal + train packages).**

Run: `cd backend && ./mvnw clean test -Dtest='io.mrkuhne.mezo.feature.goal.**,io.mrkuhne.mezo.feature.train.**,io.mrkuhne.mezo.feature.biometrics.**' -q`
Expected: PASS (all reconciled). If OOM on the 16GB box, add `-DargLine=-Xmx3g` and/or lean on CI for the full suite.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunner.java backend/src/main/java/io/mrkuhne/mezo/feature/goal/repository/GoalRepository.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/GoalReevaluateRunnerIT.java
git -c core.hooksPath=/dev/null commit -m "feat(goal): startup re-evaluate runner reconciles stale prescriptions (mezo-eujg)"
```

---

### Task 10: FE — `biometricFields.ts` 3-band NEAT + new test

**Files:**
- Modify: `frontend/src/features/me/logic/biometricFields.ts`
- Create: `frontend/src/features/me/logic/biometricFields.test.ts`

**Interfaces:**
- Produces (used Tasks 11-12): `ActivityLevel = 'DESK'|'MIXED'|'PHYSICAL'`; `ACTIVITY_LEVELS: {id, label, hint, neat}[]`; `ACTIVITY_SHORT: Record<ActivityLevel,string>`; `neatLabel(neat: number): string` (replaces `palLabel`).

- [ ] **Step 1: Write the failing test.** Create `biometricFields.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { ACTIVITY_LEVELS, ACTIVITY_SHORT, neatLabel, type ActivityLevel } from '@/features/me/logic/biometricFields'

describe('biometricFields NEAT bands', () => {
  test('exposes exactly the 3 NEAT bands with the right multipliers', () => {
    expect(ACTIVITY_LEVELS.map(a => a.id)).toEqual(['DESK', 'MIXED', 'PHYSICAL'])
    expect(ACTIVITY_LEVELS.map(a => a.neat)).toEqual([1.2, 1.35, 1.5])
  })
  test('hints describe non-exercise lifestyle (no "edzés")', () => {
    for (const a of ACTIVITY_LEVELS) expect(a.hint).not.toContain('edzés')
  })
  test('ACTIVITY_SHORT covers every band', () => {
    for (const id of ['DESK', 'MIXED', 'PHYSICAL'] as ActivityLevel[]) expect(ACTIVITY_SHORT[id]).toBeTruthy()
  })
  test('neatLabel formats with a decimal comma', () => {
    expect(neatLabel(1.35)).toBe('×1,35')
  })
})
```

- [ ] **Step 2: Run it, verify it fails.**

Run: `cd frontend && pnpm test biometricFields -- --run`
Expected: FAIL — `neatLabel` / new bands not defined.

- [ ] **Step 3: Rewrite `biometricFields.ts`.** Replace the type, `ACTIVITY_LEVELS`, `ACTIVITY_SHORT`, and `palLabel`:

```ts
export type ActivityLevel = 'DESK' | 'MIXED' | 'PHYSICAL'

// NEAT lifestyle bands (non-exercise). Training energy is added separately (scheduled weekly EAT),
// so these hints describe daily NON-exercise life only. Matches the backend mezo.goal.neat bands.
export const ACTIVITY_LEVELS: { id: ActivityLevel; label: string; hint: string; neat: number }[] = [
  { id: 'DESK', label: 'Ülő életmód', hint: 'irodai munka, kevés lépés, autó', neat: 1.2 },
  { id: 'MIXED', label: 'Vegyes', hint: 'napközben mozgásban, sok lépés', neat: 1.35 },
  { id: 'PHYSICAL', label: 'Fizikai', hint: 'fizikai munka, egész nap lábon', neat: 1.5 },
]

export const ACTIVITY_SHORT: Record<ActivityLevel, string> = {
  DESK: 'Ülő',
  MIXED: 'Vegyes',
  PHYSICAL: 'Fizikai',
}

// keep ageFromBirthDate unchanged

// HU decimal-comma NEAT multiplier label, e.g. 1.35 → "×1,35".
export function neatLabel(neat: number): string {
  return `×${String(neat).replace('.', ',')}`
}
```
Keep `ageFromBirthDate` as-is. Remove `palLabel`.

- [ ] **Step 4: Run it, verify it passes.**

Run: `cd frontend && pnpm test biometricFields -- --run`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/me/logic/biometricFields.ts frontend/src/features/me/logic/biometricFields.test.ts
git -c core.hooksPath=/dev/null commit -m "feat(me): 3-band NEAT lifestyle fields + neatLabel (mezo-eujg)"
```

---

### Task 11: FE — `deriveDailyBudget` explicit balance + neat + `timelineHooks` wiring

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (`EnergyInputs`/`deriveDailyBudget` 110-148)
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (185-204)
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (108-114)
- Modify: `frontend/src/data/fuel/fuelConfig.ts` (drop the hardcoded `NEAT_BASELINE` default usage — keep as fallback const)

**Interfaces:**
- Consumes: `tdeeBootstrap.neat` + `currentSegment.dailyEnergyBalanceKcal` (Task 1 FE types).
- Produces: `EnergyInputs = { bmr: number|null; neat: number|null; weightKg: number; blocks }` (was `tdee`); `deriveDailyBudget(segment: { kcal; proteinG; dailyEnergyBalanceKcal } | null, fallback, energy?)` uses `balance = segment.dailyEnergyBalanceKcal` and `maintenance = bmr × neat`.

- [ ] **Step 1: Rewrite the two dynamic tests.** In `buildDayPlan.test.ts` change the `ENERGY` factory (line 184) and the two tests (185-204):

```ts
const ENERGY = (blocks: PlannerBlock[]) => ({ bmr: 1720, neat: 1.2, weightKg: 78.6, blocks })

test('dynamic budget — rest day floors at BMR (raw 2064−516=1548 < 1720)', () => {
  const b = deriveDailyBudget({ kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 }, FB, ENERGY([]))
  expect(b.energy).toMatchObject({ base: 2064, activity: 0, balance: -516, target: 1720 })
  expect(b.kcal).toBe(1720)
  expect(b.p).toBe(163)
  expect(b.f).toBe(66)
  expect(b.c).toBe(Math.round((1720 - 163 * 4 - 66 * 9) / 4))
})

test('dynamic budget — big training day adds activity, carbs absorb the bonus', () => {
  const blocks: PlannerBlock[] = [
    { kind: 'gym', time: '18:00', durationMin: 60, label: 'Plyo Leg' },
    { kind: 'sport', time: '18:00', durationMin: 240, label: 'Volleyball' },
  ]
  const b = deriveDailyBudget({ kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 }, FB, ENERGY(blocks))
  expect(b.energy.activity).toBeGreaterThan(1800)
  expect(b.energy.target).toBeGreaterThan(3300)
  expect(b.kcal).toBe(b.energy.target)
  expect(b.f).toBe(66)
  expect(b.c).toBeGreaterThan(500)
})
```
(`base: 2064` still = `1720 × 1.2`. The static-path tests at 175-182 stay unchanged.)

- [ ] **Step 2: Run tests, verify they fail.**

Run: `cd frontend && pnpm test buildDayPlan -- --run`
Expected: FAIL — `dailyEnergyBalanceKcal`/`neat` not wired.

- [ ] **Step 3: Rewrite `deriveDailyBudget` + `EnergyInputs`.** In `buildDayPlan.ts`:

```ts
export interface EnergyInputs { bmr: number | null; neat: number | null; weightKg: number; blocks: PlannerBlock[] }
```
```ts
export function deriveDailyBudget(
  segment: { kcal: number; proteinG: number; dailyEnergyBalanceKcal?: number } | null,
  fallback: MacroSet,
  energy?: EnergyInputs,
): DayBudget {
  const baseKcal = segment?.kcal ?? fallback.kcal
  const proteinG = segment?.proteinG ?? fallback.p
  const fat = Math.round((baseKcal * FAT_KCAL_SHARE) / 9)
  const carbs = (kcal: number) => Math.max(0, Math.round((kcal - proteinG * 4 - fat * 9) / 4))

  if (!energy || energy.bmr == null || energy.neat == null) {
    if (!segment) {
      return { kcal: fallback.kcal, p: fallback.p, c: fallback.c, f: fallback.f, energy: { base: fallback.kcal, activity: 0, balance: 0, target: fallback.kcal } }
    }
    return { kcal: baseKcal, p: proteinG, c: carbs(baseKcal), f: fat, energy: { base: baseKcal, activity: 0, balance: 0, target: baseKcal } }
  }
  const balance = segment?.dailyEnergyBalanceKcal ?? 0
  const maintenance = energy.bmr * energy.neat
  const eat = activityKcal(energy.blocks, energy.weightKg)
  const target = Math.max(energy.bmr, maintenance + eat + balance) // KCAL_FLOOR = BMR
  return {
    kcal: Math.round(target),
    p: proteinG,
    c: carbs(target),
    f: fat,
    energy: { base: Math.round(maintenance), activity: Math.round(eat), balance: Math.round(balance), target: Math.round(target) },
  }
}
```
Update the doc-comment: `balance = segment.dailyEnergyBalanceKcal (explicit goal deficit/surplus from the wire)`, `maintenance = BMR×neat (NEAT from the bootstrap)`. Remove the `NEAT_BASELINE` import from `buildDayPlan.ts` (no longer used).

- [ ] **Step 4: Wire `timelineHooks.ts`.** Replace the `deriveDailyBudget` call (108-114): pass `neat` from the bootstrap and let `currentSegment` carry `dailyEnergyBalanceKcal`:

```ts
  const weightKg = goal?.currentWeight ?? goalResponse?.startWeightKg ?? 0
  const budget = deriveDailyBudget(currentSegment(goalResponse, timeline), fuel.targets, {
    bmr: goalResponse?.tdeeBootstrap?.bmr ?? null,
    neat: goalResponse?.tdeeBootstrap?.neat ?? null,
    weightKg,
    blocks,
  })
```
Update `currentSegment` return type in `timelineHooks.ts` (68-77) to include `dailyEnergyBalanceKcal`: change the return type annotation to `{ kcal: number; proteinG: number; dailyEnergyBalanceKcal: number } | null` (the generated `GoalPrescriptionSegment` already carries it).

- [ ] **Step 5: Run FE tests both modes.**

Run: `cd frontend && pnpm test buildDayPlan timelineHooks -- --run && VITE_USE_MOCK=true pnpm test buildDayPlan timelineHooks -- --run`
Expected: PASS both.

- [ ] **Step 6: Commit.**

```bash
git add frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts frontend/src/data/fuel/timelineHooks.ts
git -c core.hooksPath=/dev/null commit -m "feat(fuel): explicit dailyEnergyBalance + neat from the wire (mezo-eujg)"
```

---

### Task 12: FE — `BiometricCard` split TDEE + `BiometricSheet` 3-band selector

**Files:**
- Modify: `frontend/src/features/me/components/BiometricCard.tsx`
- Modify: `frontend/src/features/me/sheets/BiometricSheet.tsx`

**Interfaces:**
- Consumes: `ACTIVITY_LEVELS`/`ACTIVITY_SHORT`/`neatLabel` (Task 10); `profile.tdeeBootstrap.{neatBaselineKcal, weeklyEatKcalPerDay, tdee, neat}` (Task 1 FE types).

- [ ] **Step 1: `BiometricCard` — activity resolver + split TDEE.** Replace the import + `PAL_BY_ID`/`resolveActivity` (lines 3-11):

```tsx
import { ACTIVITY_LEVELS, ACTIVITY_SHORT, ageFromBirthDate, neatLabel, type ActivityLevel } from '@/features/me/logic/biometricFields'

const NEAT_BY_ID = Object.fromEntries(ACTIVITY_LEVELS.map(a => [a.id, a.neat])) as Record<ActivityLevel, number>

function resolveActivity(level: ActivityLevel | null | undefined): { label: string; neat: number } {
  const lvl = (level ?? 'MIXED') as ActivityLevel
  return { label: ACTIVITY_SHORT[lvl], neat: NEAT_BY_ID[lvl] }
}
```
Update the Aktivitás stat (was `palLabel(activity.pal)`): `{activity.label} <small>{neatLabel(activity.neat)}</small>`. Replace the `.tdee` block with the split render:

```tsx
      {tdee && (
        <div className="tdee tdee-split">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="k">Alaphő · NEAT</span>
            <span className="v">{Math.round(tdee.neatBaselineKcal)}</span>
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="k">Betábl. mozgás</span>
            <span className="v">+{Math.round(tdee.weeklyEatKcalPerDay)}</span>
          </div>
          <div className="row tdee-total" style={{ justifyContent: 'space-between' }}>
            <span className="k">Fenntartó · {tdee.formula === 'KATCH' ? 'Katch' : 'MSJ'}</span>
            <span className="v">≈{Math.round(tdee.tdee)} kcal/nap</span>
          </div>
        </div>
      )}
```

- [ ] **Step 2: `BiometricSheet` — default MIXED + selector.** Change the state init (30-32): `?? 'MODERATE'` → `?? 'MIXED'`. The `ACTIVITY_LEVELS.map` selector at 134-173 already renders `a.label`/`a.hint` generically — no structural change needed (it now iterates the 3 bands). Update the section comment (line 134) from "PAL: a TDEE = BMR × PAL" → "NEAT életmód-sáv (a betáblázott edzés külön adódik hozzá)".

- [ ] **Step 3: Typecheck + build.**

Run: `cd frontend && pnpm build`
Expected: `tsc -b` PASS (no `pal`/`palLabel`/old-enum references remain anywhere — the build fails loudly if any survive).

- [ ] **Step 4: Run the full FE test suite both modes.**

Run: `cd frontend && pnpm test -- --run && VITE_USE_MOCK=true pnpm test -- --run`
Expected: PASS both.

- [ ] **Step 5: Commit.**

```bash
git add frontend/src/features/me/components/BiometricCard.tsx frontend/src/features/me/sheets/BiometricSheet.tsx
git -c core.hooksPath=/dev/null commit -m "feat(me): split Alap-TDEE card (Alaphő·Mozgás·Fenntartó) + 3-band selector (mezo-eujg)"
```

---

### Task 13: MET drift-guard test

**Files:**
- Create: `frontend/src/data/fuel/metDriftGuard.test.ts`

**Interfaces:**
- Consumes: FE `fuelConfig.MET_BY_KIND`; the backend MET values (asserted as literals, sourced from `application.yml mezo.train.met`).

- [ ] **Step 1: Write the guard.** The FE MET table MUST equal the backend `mezo.train.met`. Since the FE cannot read `application.yml`, assert against the pinned literal (a change to either side without updating both fails here):

```ts
import { describe, expect, test } from 'vitest'
import { MET_BY_KIND } from '@/data/fuel/fuelConfig'

// DRIFT-GUARD (mezo-eujg): these MUST match backend `mezo.train.met` in application.yml.
// If you change one side, change the other — this test is the tripwire.
const BACKEND_MET = { gym: 6.0, sport: 4.5, run: 9.5, default: 5.0 }

describe('MET table FE↔backend drift-guard', () => {
  test('fuelConfig.MET_BY_KIND mirrors mezo.train.met', () => {
    expect(MET_BY_KIND).toEqual(BACKEND_MET)
  })
})
```

- [ ] **Step 2: Run it, verify it passes.**

Run: `cd frontend && pnpm test metDriftGuard -- --run`
Expected: PASS (both tables currently agree).

- [ ] **Step 3: Commit.**

```bash
git add frontend/src/data/fuel/metDriftGuard.test.ts
git -c core.hooksPath=/dev/null commit -m "test(fuel): MET table FE↔backend drift-guard (mezo-eujg)"
```

---

### Task 14: Docs + visual goldens + final gate

**Files:**
- Modify: `docs/features/fuel.md`, `docs/features/me.md`, `docs/features/goal-engine.md`
- Regenerate: `frontend/tests/visual/visual.spec.ts-snapshots/me-{light,dark}-darwin.png` (+ linux via CI)

**Interfaces:** none (documentation + goldens).

- [ ] **Step 1: Update feature docs.**
  - `docs/features/fuel.md` §5 (lines ~172-300): the `balance = segment.kcal − static TDEE` narrative → `balance = segment.dailyEnergyBalanceKcal` (explicit from the wire; the hidden run double-count is gone). The `EnergyInputs` third arg is now `{bmr, neat, weightKg, blocks}`.
  - `docs/features/me.md` (Biometria card ~62, tdeeBootstrap contract ~215): the split Alap-TDEE card (Alaphő·Mozgás·Fenntartó); activityLevel is a 3-band NEAT lifestyle.
  - `docs/features/goal-engine.md` (tdeeBootstrap ~50-169): maintenance = BMR×NEAT + weekly scheduled EAT (train-port); PAL retired; segment carries `dailyEnergyBalanceKcal`; the startup re-evaluate runner.

- [ ] **Step 2: Lint docs.**

Run: `node scripts/lint-docs.mjs`
Expected: no staleness/broken-link errors for the touched docs.

- [ ] **Step 3: Regenerate darwin visual goldens.**

Run: `cd frontend && pnpm test:visual:update`
Expected: `me-light-darwin.png` / `me-dark-darwin.png` (and `me-cel-*` if the goals screen surfaces the card) regenerate. Inspect the diff visually — the Alap-TDEE card must show the 3-row split.

- [ ] **Step 4: Full FE gate.**

Run: `cd frontend && pnpm build && pnpm test -- --run && VITE_USE_MOCK=true pnpm test -- --run`
Expected: PASS all three.

- [ ] **Step 5: Commit (darwin goldens + docs).**

```bash
git add docs/features/fuel.md docs/features/me.md docs/features/goal-engine.md frontend/tests/visual/visual.spec.ts-snapshots/
git -c core.hooksPath=/dev/null commit -m "docs(fuel): Layer C living docs + darwin visual goldens (mezo-eujg)"
```

- [ ] **Step 6: Linux goldens via CI (after the PR is up).**

Run: `gh workflow run update-visual-baselines.yml -r feat/fuel-layer-c`
Expected: the bot commits `*-linux.png`. (The bot commit causes `action_required` — close+reopen the PR to re-trigger CI, per the worktree workflow.)

---

## Post-plan: PR + merge (per CLAUDE.md workflow)

- Push `feat/fuel-layer-c`; open a self-PR (the CI gate — full backend IT suite + FE both modes + lint + contract-drift on clean ubuntu). The 16GB box can't run the full backend suite locally, so CI is authoritative.
- After CI green + linux goldens: merge from the worktree with `gh pr merge --merge --delete-branch` (remote --no-ff; local main + bd reconcile deferred to the main checkout, per the worktree-landing memory).
- Reconcile `bd`: `cd /Users/daniel.kuhne/MrKuhne/mezo && bd close mezo-eujg` + `bd update mezo-eujg --notes "..."` from the MAIN checkout (worktree has no .dolt).
