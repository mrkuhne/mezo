# Diet Plan Slice 5 — Weekly Adaptive Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Monday job compares the observed EWMA weight-trend rate against the goal's target rate and, when they diverge beyond a dead-band, proposes a smoothed, clamped kcal correction (damped by a sleep-debt guard) as a `weekly_correction` goal suggestion; accepting writes a `balance_adjustment_kcal` onto the goal and re-evaluates with `basis="adaptive"`.

**Architecture:** A pure `AdaptiveCorrectionService` (feature/goal/engine) computes the correction from trend + config; `AdaptiveReviewService` orchestrates per-user (sufficiency gate, sleep guard via a goal-owned `SleepAdequacyPort` implemented in biometrics/sleep, intake-adherence context via a goal-owned `IntakeAdherencePort` implemented in meal, ADR 0012) and emits the suggestion through slice 4's `GoalSuggestionService`; `AdaptiveReviewJob` is the `WeeklyReviewJob`-idiom cron shell. The accept path adds a `weekly_correction` branch to slice 4's accept dispatch.

**Tech Stack:** Spring Boot (feature packages under `io.mrkuhne.mezo.feature`), Liquibase yml-master + raw SQL scripts, jsonb via `@JdbcTypeCode(SqlTypes.JSON)`, openapi-generated contract, React 19 + TanStack Query FE with dual real/mock modes, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-diet-plan-design.md` (§6.6, §6.8, §6.9)

**Depends on:** slice 1 (diet config conventions; not a hard code dependency) and **slice 4 (hard dependency)**. Slice 4's final interface, consumed verbatim:

- `GoalSuggestionEntity` — fields `goalId`, `kind` (`phase_change|weekly_correction`), `status` (`proposed|accepted|dismissed|superseded`), `dedupKey` (unique index on `(goal_id, dedup_key)`; dedup includes DECIDED rows, so a dismissed week is never re-proposed), `payload` (strongly typed `GoalSuggestionPayloadJson` via `@JdbcTypeCode(SqlTypes.JSON)`), `createdAt`, `decidedAt`.
- `GoalSuggestionPayloadJson` — record `(String reason, String suggestedTrajectory, Integer balanceOverrideKcal, Integer fromWeek, Integer toWeek, UUID mesoId, String mesoTitle, String snapshotTrajectory)`; this slice APPENDS nullable weekly-correction fields to it (Task 7) — no separate payload type exists.
- `GoalSuggestionService.propose(UUID userId, UUID goalId, String kind, String dedupKey, GoalSuggestionPayloadJson payload)` → the entity, or `null` when the dedup index already holds that key; per-kind accept dispatch switching on `KIND_PHASE_CHANGE` / `KIND_WEEKLY_CORRECTION` constants; `accept` / `dismiss`.
- Endpoints: `GET /api/goals/{id}/suggestions`, `POST /api/goals/{id}/suggestions/{suggestionId}/accept` (200; 409 on a stale snapshot), `POST /api/goals/{id}/suggestions/{suggestionId}/dismiss` (204). DTOs `GoalSuggestionResponse` / `GoalSuggestionPayload`.
- FE: hooks `useGoalSuggestions` / `useSuggestionActions`, components `GoalSuggestionCard` + `DietSuggestionBanner`.

## Global Constraints

- **Contract-drift gate:** any `api/feature/goal/goal.yml` change requires regenerating BOTH clients in the same commit: `cd api/generate && npm run generate:api` (backend) and `cd frontend && pnpm generate:api` (FE). CI fails on drift.
- **CODEMAP freshness:** new backend classes/FE files → run `node scripts/gen-codemap.mjs` before the final commit (`--check` is the CI gate).
- **Frozen ArchUnit store:** after any backend test run, `git status` must show NO deletions under the archunit store; restore with `git checkout -- <store path>` if a run emptied it.
- **Backend tests:** focused only — `./mvnw test -Dtest=<ClassName>` (never the bare full suite locally; CI is the authoritative gate).
- **FE tests both modes:** `cd frontend && pnpm test <path>` AND `VITE_USE_MOCK=true pnpm test <path>`; mock fixtures must gain every new contract field.
- **Commits:** conventional, English, carrying the driving bd id: `feat(goal): ... (mezo-XXXX)` — replace `mezo-XXXX` with the slice's bd issue id at execution time.
- **Code/comments English; user-facing copy Hungarian**, matching the existing rationale/notes tone (see `GoalProjectionService.rationale`).
- **Engine invariants:** every tunable lives in `GoalEngineProperties` (`mezo.goal.*`) — no `@Value`, no hardcoded constants; engine services stay pure/deterministic; `evaluate` never throws on missing data.

---

### Task 1: Config — `GoalEngineProperties.Adaptive` + application.yml + job switch

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java`
- Modify: `backend/src/main/resources/application.yml` (the `mezo.goal:` block, ~line 28; the `mezo.techcore.cron` switches block ~line 332)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/GoalEnginePropertiesIT.java` (extend if it exists; otherwise the binding is covered by any context-loading IT — verify via Task 5's test)

**Interfaces:**
- Consumes: existing `GoalEngineProperties` record layout.
- Produces: `props.adaptive()` → record `Adaptive(Integer maxStepKcal, Integer deadBandKcal, Integer sleepDebtNights, Integer sleepDebtMinNights, Double sleepDebtDeficitHours)`; switch constant `FeaturesConfiguration.ADAPTIVE_REVIEW_JOB_SWITCH = "mezo.techcore.cron.adaptive-review-job.enabled"`; cron key `mezo.goal.adaptive.cron`.

- [ ] **Step 1: Add the `Adaptive` nested record and field to `GoalEngineProperties`**

Append a component to the top-level record (after `bootstrapUncertaintyKcal`):

```java
    /** Weekly adaptive-review tunables (slice 5): correction clamp, dead-band, sleep-debt guard window. */
    @NotNull @Valid Adaptive adaptive
```

and the nested record at the bottom of the class (after `Ewma`):

```java
    /**
     * Weekly adaptive-review tunables. The correction is
     * {@code clamp((targetRate − observedRate) × kcalPerKg ÷ 7, ±maxStepKcal)} — deliberately small
     * steps (RP's unsmoothed 200g→50g jumps are the anti-pattern; MacroFactor-style smoothing).
     */
    public record Adaptive(
        @NotNull @Min(50) @Max(300) Integer maxStepKcal,        // 120 — max suggested change per week
        @NotNull @Min(10) @Max(150) Integer deadBandKcal,       // 50 — below this, no suggestion at all
        @NotNull @Min(3) @Max(14) Integer sleepDebtNights,      // 7 — guard window (spec §6.6: 7-day)
        @NotNull @Min(2) @Max(14) Integer sleepDebtMinNights,   // 4 — honest small-n gate
        @NotNull @Positive Double sleepDebtDeficitHours          // 5.0 — cumulative deficit that trips the guard
    ) {
    }
```

- [ ] **Step 2: Bind the values in `application.yml`**

Inside the existing `mezo.goal:` block (sibling of `ewma:` etc.):

```yaml
    # Weekly adaptive review (diet-plan slice 5): smoothed kcal-correction suggestions.
    adaptive:
      # Max suggested kcal/day change per weekly review — small steps, never RP-style jumps.
      max-step-kcal: 120
      # Needed-change magnitudes below this produce NO suggestion (the plan is on track).
      dead-band-kcal: 50
      # Sleep-debt guard window (nights, ending today — sleep_log.date is the wake morning).
      sleep-debt-nights: 7
      # Honest small-n gate: fewer logged nights than this ⇒ the guard cannot fire.
      sleep-debt-min-nights: 4
      # Cumulative deficit (hours) vs the sleep goal at/above which deficit-increasing corrections are halved.
      sleep-debt-deficit-hours: 5.0
      # Monday morning, before the proactive weekly-review job (6:50), after typical wake weigh-ins.
      cron: "0 40 6 * * MON"
```

And in the `mezo.techcore.cron` switches block (mirror the `weekly-review-job` comment style):

```yaml
      # Monday adaptive-review suggestion generation (diet-plan slice 5,
      # schedule: mezo.goal.adaptive.cron); off = the AdaptiveReviewJob bean does not exist
      adaptive-review-job:
        enabled: true
```

- [ ] **Step 3: Add the switch constant to `FeaturesConfiguration`**

```java
    /** Monday adaptive-review job (diet-plan slice 5) — weekly_correction goal suggestions. */
    public static final String ADAPTIVE_REVIEW_JOB_SWITCH = "mezo.techcore.cron.adaptive-review-job.enabled";
```

- [ ] **Step 4: Compile**

Run: `./mvnw compile -q`
Expected: BUILD SUCCESS (binding is validated by the first IT that loads the context — Task 5).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/GoalEngineProperties.java \
        backend/src/main/resources/application.yml \
        backend/src/main/java/io/mrkuhne/mezo/techcore/configuration/FeaturesConfiguration.java
git commit -m "feat(goal): adaptive-review tunables + job switch (mezo-XXXX)"
```

### Task 2: `goal.balance_adjustment_kcal` column + entity field + projection application

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021000_mezo-XXXX_goal_balance_adjustment.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java:272-285` (`dailyEnergyBalance`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionServiceIT.java` (extend)

**Interfaces:**
- Consumes: `GoalEntity` (OwnedEntity idiom), `GoalProjectionService.dailyEnergyBalance(GoalEntity, BigDecimal)`.
- Produces: `goalEntity.getBalanceAdjustmentKcal()` → `Integer` (nullable, treated as 0); `dailyEnergyBalance` = trajectory balance + adjustment (applied for ALL trajectories, maintain included — an accepted correction on a maintain goal is a deliberate calibration).

- [ ] **Step 1: Write the failing IT case**

In `GoalProjectionServiceIT`, next to the existing `dailyEnergyBalance`-shaped cases (follow the file's fixture style for building a goal — copy an existing test's goal setup):

```java
    @Test
    void balanceAdjustmentShiftsTheDailyEnergyBalance() {
        // cut goal, 0.6 %BW/wk at 80 kg → base balance ≈ −528 kcal/day (0.006×80×7700/7)
        GoalEntity goal = cutGoal80kgRate06(); // reuse/adapt the file's existing goal fixture helper
        goal.setBalanceAdjustmentKcal(-120);   // an accepted "cut deeper" weekly correction

        List<ProjectionSegment> withAdjustment = projectionService.project(goal, userId, bootstrap(), noTrend());
        goal.setBalanceAdjustmentKcal(null);
        List<ProjectionSegment> baseline = projectionService.project(goal, userId, bootstrap(), noTrend());

        int delta = withAdjustment.get(0).dailyEnergyBalanceKcal() - baseline.get(0).dailyEnergyBalanceKcal();
        assertThat(delta).isEqualTo(-120);
    }
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./mvnw test -Dtest=GoalProjectionServiceIT#balanceAdjustmentShiftsTheDailyEnergyBalance`
Expected: COMPILE ERROR — `setBalanceAdjustmentKcal` undefined.

- [ ] **Step 3: Migration SQL**

`202609021000_mezo-XXXX_goal_balance_adjustment.sql`:

```sql
-- mezo-XXXX (diet-plan slice 5): accepted adaptive corrections accumulate here; the projection
-- adds it to the trajectory's daily energy balance. NULL/0 = no correction accepted yet.
alter table goal add column balance_adjustment_kcal integer;
```

Register in `1.0.0_master.yml` (append, mirroring the `202608242315_mezo-dq60_goal_preset` changeSet block exactly — same author/id/path idiom):

```yaml
  - changeSet:
      id: "1.0.0:202609021000_mezo-XXXX_goal_balance_adjustment"
      author: mezo
      changes:
        - sqlFile:
            path: script/202609021000_mezo-XXXX_goal_balance_adjustment.sql
            relativeToChangelogFile: true
```

(Copy the surrounding changeSets' exact attribute set — if they carry `logicalFilePath` or omit `author`, match them.)

- [ ] **Step 4: Entity field**

In `GoalEntity`, after `identityFrame`:

```java
    /** Accepted adaptive-review corrections (kcal/day), summed; slice 5. Null = 0. */
    @Column(name = "balance_adjustment_kcal")
    private Integer balanceAdjustmentKcal;
```

- [ ] **Step 5: Apply it in `dailyEnergyBalance`**

Replace the method body's return path so the adjustment applies to every trajectory:

```java
    private BigDecimal dailyEnergyBalance(GoalEntity goal, BigDecimal weightKg) {
        BigDecimal adjustment = goal.getBalanceAdjustmentKcal() == null
            ? BigDecimal.ZERO : BigDecimal.valueOf(goal.getBalanceAdjustmentKcal());
        if (TRAJ_MAINTAIN.equalsIgnoreCase(goal.getTrajectory())) {
            return adjustment; // an accepted correction calibrates maintain too
        }
        BigDecimal weeklyKgMagnitude = goal.getRateTargetPctPerWeek()
            .divide(ONE_HUNDRED, 10, RoundingMode.HALF_UP)
            .multiply(weightKg);
        BigDecimal dailyKcalMagnitude = weeklyKgMagnitude
            .multiply(BigDecimal.valueOf(props.kcalPerKg()))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
        BigDecimal base = TRAJ_BULK.equalsIgnoreCase(goal.getTrajectory())
            ? dailyKcalMagnitude
            : dailyKcalMagnitude.negate(); // cut (default for any non-bulk/non-maintain)
        return base.add(adjustment);
    }
```

- [ ] **Step 6: Run the IT**

Run: `./mvnw test -Dtest=GoalProjectionServiceIT`
Expected: PASS (all cases — the adjustment defaults to 0, so existing cases are untouched). Then `git status` — verify the ArchUnit store was not emptied.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/resources/db/changelog/1.0.0/ \
        backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalEntity.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionServiceIT.java
git commit -m "feat(goal): balance_adjustment_kcal column applied in the daily energy balance (mezo-XXXX)"
```

### Task 3: `basis="adaptive"` + contract exposure of the adjustment

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java:64,109-110`
- Modify: `api/feature/goal/goal.yml` (GoalResponse properties, next to `mealsPerDay`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapper.java` (find it: `find backend -name GoalMapper.java`; map the new field like its siblings)
- Modify: `frontend/src/data/me/goals.ts` (mock gains the field)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java` (extend)

**Interfaces:**
- Consumes: `GoalPrescriptionJson(generatedAt, basis, segments, guardStatus, feasibility)`; existing `basis` contract enum `[formula, adaptive]` (goal.yml:175 — already there, no enum change).
- Produces: `GoalResponse.balanceAdjustmentKcal?: number` on the wire; prescriptions carry `basis="adaptive"` iff `goal.balanceAdjustmentKcal` is non-null and non-zero.

- [ ] **Step 1: Failing IT case**

In `GoalEvaluationServiceIT` (pure service — follow the file's existing call style for `assemble`):

```java
    @Test
    void basisFlipsToAdaptiveWhenAnAdjustmentIsAccepted() {
        GoalEntity goal = anyCutGoal();
        goal.setBalanceAdjustmentKcal(-120);
        GoalPrescriptionJson rx = evaluationService.assemble(
            goal, new BigDecimal("80"), null, someSegments(), emptyGuards());
        assertThat(rx.basis()).isEqualTo("adaptive");

        goal.setBalanceAdjustmentKcal(null);
        assertThat(evaluationService.assemble(
            goal, new BigDecimal("80"), null, someSegments(), emptyGuards()).basis())
            .isEqualTo("formula");
    }
```

- [ ] **Step 2: Run to verify it fails**

Run: `./mvnw test -Dtest=GoalEvaluationServiceIT#basisFlipsToAdaptiveWhenAnAdjustmentIsAccepted`
Expected: FAIL — basis is always `"formula"`.

- [ ] **Step 3: Implement in `GoalEvaluationService`**

Add next to `BASIS_FORMULA`:

```java
    private static final String BASIS_ADAPTIVE = "adaptive";
```

and in `assemble`, replace the final construction:

```java
        String basis = goal.getBalanceAdjustmentKcal() != null && goal.getBalanceAdjustmentKcal() != 0
            ? BASIS_ADAPTIVE : BASIS_FORMULA;
        return new GoalPrescriptionJson(
            OffsetDateTime.now(), basis, rxSegments, guards, feasibility);
```

(`missingProfile` stays `BASIS_FORMULA` — no adjustment semantics without a profile.)

- [ ] **Step 4: Contract + mapper + regeneration**

In `goal.yml` `GoalResponse` properties (after `bedTime`):

```yaml
        balanceAdjustmentKcal: { type: integer, nullable: true, description: 'Accepted adaptive corrections, summed (kcal/day); slice 5' }
```

Regenerate both clients: `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`. Map the field in `GoalMapper` exactly as `mealsPerDay` is mapped (read the mapper first; MapStruct maps same-name fields automatically — if so, no edit needed, note it).

- [ ] **Step 5: Mock parity**

In `frontend/src/data/me/goals.ts`, in the mock `GoalResponse` next to `bedTime`:

```ts
  // Slice 5: no adaptive correction accepted in the mock baseline.
  balanceAdjustmentKcal: undefined,
```

- [ ] **Step 6: Run tests**

Run: `./mvnw test -Dtest=GoalEvaluationServiceIT` and `cd frontend && pnpm test src/data/me && VITE_USE_MOCK=true pnpm test src/data/me`
Expected: PASS. `git status` — ArchUnit store intact, generated clients staged.

- [ ] **Step 7: Commit**

```bash
git add api/feature/goal/goal.yml backend/ frontend/
git commit -m "feat(goal): basis=adaptive when a balance adjustment is active; expose it on GoalResponse (mezo-XXXX)"
```

### Task 4: `AdaptiveCorrectionService` — the pure correction math

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveCorrectionService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveCorrectionServiceTest.java` (plain unit test, `TdeeBootstrapServiceTest` idiom — no Spring context)

**Interfaces:**
- Consumes: `GoalEngineProperties` (`kcalPerKg`, `adaptive()`), `WeightTrendResponse` (getLast4wRateKgPerWeek, getLatestTrendKg, getDataSufficiency), `GoalEntity` (trajectory, rateTargetPctPerWeek).
- Produces: `Optional<Correction> compute(GoalEntity goal, WeightTrendResponse trend, boolean sleepDebted)` with `record Correction(int deltaKcal, BigDecimal observedRateKgPerWk, BigDecimal targetRateKgPerWk, boolean dampedBySleep, String rationaleHu)`.

**Sign convention (this plan's worked examples govern; the spec's §6.6 formula had observed/target transposed — corrected here):**
`neededKcal = (targetRate − observedRate) × kcalPerKg ÷ 7`, rates SIGNED in kg/week (cut target negative, bulk positive).
- Cut too slow — 80 kg, rate 0.6 %/wk → target −0.48; observed −0.20 → needed = (−0.28)×1100 = −308 → clamp ±120 → **−120** (deepen the deficit).
- Cut too fast — observed −0.90 → needed = (+0.42)×1100 = +462 → **+120** (ease up).
- Bulk too slow — target +0.20 (0.25 %/wk at 80 kg); observed +0.05 → needed = +165 → **+120** (eat more).
- Dead-band — observed −0.45 vs target −0.48 → needed = −33; |−33| < 50 → **no suggestion**.
- Sleep-damped — cut-too-slow −120 with sleep debt → **−60** (deficit-increasing halved); cut-too-fast +120 stays +120.

- [ ] **Step 1: Write the failing unit test with all five worked examples**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.service.AdaptiveCorrectionService.Correction;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class AdaptiveCorrectionServiceTest {

    private final AdaptiveCorrectionService service = new AdaptiveCorrectionService(props());

    // Mirror application.yml defaults; kcalPerKg 7700 → ×1100 per kg/week of gap.
    private static GoalEngineProperties props() {
        return new GoalEngineProperties(
            new GoalEngineProperties.Neat(1.20, 1.35, 1.50),
            7700,
            new GoalEngineProperties.Protein(2.0, 1.6, 2.2, 2.3, 3.1, 2.6),
            new GoalEngineProperties.Rate(0.7, 1.0, 0.5, 1.0),
            new GoalEngineProperties.Volume(8, 6),
            new GoalEngineProperties.Strength(-5.0),
            new GoalEngineProperties.Ewma(10),
            0, 300,
            new GoalEngineProperties.Adaptive(120, 50, 7, 4, 5.0));
    }

    private static GoalEntity goal(String trajectory, String ratePct) {
        GoalEntity g = new GoalEntity();
        g.setTrajectory(trajectory);
        g.setRateTargetPctPerWeek(new BigDecimal(ratePct));
        return g;
    }

    private static WeightTrendResponse trend(String observedRate, DataSufficiencyEnum sufficiency) {
        return new WeightTrendResponse(
            List.of(), new BigDecimal("80.000"), new BigDecimal(observedRate),
            BigDecimal.ZERO, new BigDecimal(observedRate), sufficiency);
    }

    @Test
    void cutTooSlowDeepensTheDeficitClampedToMaxStep() {
        Optional<Correction> c = service.compute(goal("cut", "0.6"), trend("-0.200", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(-120); // needed −308, clamped
            assertThat(v.targetRateKgPerWk()).isEqualByComparingTo("-0.48");
            assertThat(v.dampedBySleep()).isFalse();
        });
    }

    @Test
    void cutTooFastEasesUp() {
        Optional<Correction> c = service.compute(goal("cut", "0.6"), trend("-0.900", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> assertThat(v.deltaKcal()).isEqualTo(120)); // needed +462
    }

    @Test
    void bulkTooSlowAddsKcal() {
        Optional<Correction> c = service.compute(goal("bulk", "0.25"), trend("0.050", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> assertThat(v.deltaKcal()).isEqualTo(120)); // needed +165
    }

    @Test
    void deadBandSuppressesSmallGaps() {
        assertThat(service.compute(goal("cut", "0.6"), trend("-0.450", DataSufficiencyEnum.FULL), false))
            .isEmpty(); // needed −33 < dead-band 50
    }

    @Test
    void sleepDebtHalvesDeficitIncreasingCorrectionsOnly() {
        Optional<Correction> deeper = service.compute(goal("cut", "0.6"), trend("-0.200", DataSufficiencyEnum.FULL), true);
        assertThat(deeper).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(-60);
            assertThat(v.dampedBySleep()).isTrue();
        });
        Optional<Correction> easier = service.compute(goal("cut", "0.6"), trend("-0.900", DataSufficiencyEnum.FULL), true);
        assertThat(easier).hasValueSatisfying(v -> {
            assertThat(v.deltaKcal()).isEqualTo(120);
            assertThat(v.dampedBySleep()).isFalse();
        });
    }

    @Test
    void insufficientTrendYieldsNothing() {
        assertThat(service.compute(goal("cut", "0.6"), trend("-0.200", DataSufficiencyEnum.NONE), false)).isEmpty();
        assertThat(service.compute(goal("cut", "0.6"), null, false)).isEmpty();
    }

    @Test
    void maintainTargetsZeroRate() {
        // maintain drifting up at 0.15 kg/wk → needed = (0 − 0.15)×1100 = −165 → clamp −120.
        Optional<Correction> c = service.compute(goal("maintain", "0.0"), trend("0.150", DataSufficiencyEnum.FULL), false);
        assertThat(c).hasValueSatisfying(v -> assertThat(v.deltaKcal()).isEqualTo(-120));
    }
}
```

(Note: the `GoalEngineProperties` constructor argument order must match Task 1's final record — verify before running. If `WeightTrendResponse`'s generated constructor differs, build it with its builder/setters instead — check the generated DTO.)

- [ ] **Step 2: Run to verify it fails**

Run: `./mvnw test -Dtest=AdaptiveCorrectionServiceTest`
Expected: COMPILE ERROR — class does not exist.

- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The weekly adaptive-review correction math (diet-plan slice 5). Pure + deterministic:
 * {@code neededKcal = (targetRate − observedRate) × kcalPerKg ÷ 7} with signed kg/week rates
 * (cut negative, bulk positive, maintain 0), a dead-band (small gaps are on-track, not noise to
 * chase) and a ±maxStep clamp (small smoothed steps — the RP unsmoothed-jump anti-pattern is what
 * the clamp exists to avoid). The sleep guard halves a deficit-increasing (negative) correction;
 * corrections that ADD food are never damped.
 *
 * <p>Gates: no trend, sufficiency {@code none}, or a null observed rate → empty. The observed
 * spine is {@code last4wRateKgPerWeek} — the same reconciliation source the projection uses.
 */
@Service
@RequiredArgsConstructor
public class AdaptiveCorrectionService {

    private static final String TRAJ_BULK = "bulk";
    private static final String TRAJ_MAINTAIN = "maintain";
    private static final int DAYS_PER_WEEK = 7;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final GoalEngineProperties props;

    /** The proposed weekly correction; {@code deltaKcal} is the signed kcal/day suggestion. */
    public record Correction(
        int deltaKcal,
        BigDecimal observedRateKgPerWk,
        BigDecimal targetRateKgPerWk,
        boolean dampedBySleep,
        String rationaleHu) {
    }

    /**
     * Compute the correction, or empty when the trend is not trustworthy yet ({@code none}), the
     * gap sits inside the dead-band, or the (possibly damped) step rounds to 0.
     */
    public Optional<Correction> compute(GoalEntity goal, WeightTrendResponse trend, boolean sleepDebted) {
        if (trend == null || trend.getDataSufficiency() == null
            || trend.getDataSufficiency() == DataSufficiencyEnum.NONE
            || trend.getLast4wRateKgPerWeek() == null
            || trend.getLatestTrendKg() == null || trend.getLatestTrendKg().signum() <= 0) {
            return Optional.empty();
        }

        BigDecimal observed = trend.getLast4wRateKgPerWeek();
        BigDecimal target = targetRateKgPerWk(goal, trend.getLatestTrendKg());

        BigDecimal neededKcal = target.subtract(observed)
            .multiply(BigDecimal.valueOf(props.kcalPerKg()))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), 2, RoundingMode.HALF_UP);

        if (neededKcal.abs().compareTo(BigDecimal.valueOf(props.adaptive().deadBandKcal())) < 0) {
            return Optional.empty(); // on track — silence, not micro-nudges
        }

        int maxStep = props.adaptive().maxStepKcal();
        int delta = neededKcal
            .max(BigDecimal.valueOf(-maxStep))
            .min(BigDecimal.valueOf(maxStep))
            .setScale(0, RoundingMode.HALF_UP)
            .intValueExact();

        boolean damped = sleepDebted && delta < 0;
        if (damped) {
            delta = delta / 2; // deficit-increasing under sleep debt → half step (recovery guard)
        }
        if (delta == 0) {
            return Optional.empty();
        }
        return Optional.of(new Correction(delta, observed, target, damped, rationale(delta, observed, target, damped)));
    }

    /** Signed target rate (kg/week): cut negative, bulk positive, maintain 0. */
    private BigDecimal targetRateKgPerWk(GoalEntity goal, BigDecimal weightKg) {
        if (TRAJ_MAINTAIN.equalsIgnoreCase(goal.getTrajectory())) {
            return BigDecimal.ZERO;
        }
        BigDecimal magnitude = goal.getRateTargetPctPerWeek() == null
            ? BigDecimal.ZERO
            : goal.getRateTargetPctPerWeek().divide(ONE_HUNDRED, 10, RoundingMode.HALF_UP).multiply(weightKg);
        BigDecimal scaled = magnitude.setScale(2, RoundingMode.HALF_UP);
        return TRAJ_BULK.equalsIgnoreCase(goal.getTrajectory()) ? scaled : scaled.negate();
    }

    private static String rationale(int delta, BigDecimal observed, BigDecimal target, boolean damped) {
        String direction = delta < 0 ? "csökkentés" : "növelés";
        String base = String.format(
            "A mért trend %s kg/hét, a cél %s kg/hét — a heti felülvizsgálat %+d kcal/nap %st javasol.",
            observed.setScale(2, RoundingMode.HALF_UP).toPlainString(),
            target.toPlainString(), delta, direction);
        return damped
            ? base + " Az alváshiány miatt a deficit-mélyítés a felére tompítva."
            : base;
    }
}
```

- [ ] **Step 4: Run the tests**

Run: `./mvnw test -Dtest=AdaptiveCorrectionServiceTest`
Expected: PASS (all 7). Check `git status` for the ArchUnit store.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveCorrectionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveCorrectionServiceTest.java
git commit -m "feat(goal): adaptive correction math — dead-band, clamp, sleep damping (mezo-XXXX)"
```

### Task 5: `SleepAdequacyPort` + biometrics/sleep adapter

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/port/SleepAdequacyPort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/GoalSleepAdequacyAdapter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/GoalSleepAdequacyAdapterIT.java`

**Interfaces:**
- Consumes: `SleepLogEntity` repository finders (read the repo interface for the owned-range finder name — there is one for the log list; if only `findAllOwned` exists, filter by date in the adapter), `SleepGoalEntity` via `sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)` (the `FlagEvaluator` idiom), `GoalEngineProperties.adaptive()` window config.
- Produces: `boolean sleepDebted(UUID userId, LocalDate today)` — true when, over the last `sleepDebtNights` nights (ending today; `sleep_log.date` is the wake morning), at least `sleepDebtMinNights` are logged AND the cumulative deficit vs the sleep goal (fallback: the flag config's default is companion-owned — use 8.0 via the sleep goal ghost; hardcode `DEFAULT_GOAL_HOURS = 8.0` with a comment) is ≥ `sleepDebtDeficitHours`.

**Why a port + reimplementation instead of reusing `FlagEvaluator.sleepDebt`:** `FlagEvaluator` is companion-owned, gated behind `COMPANION_SWITCH` (the bean may not exist), private, and hardwired to `MetricSeriesService` + `FlagProperties` (3-night window). The goal engine needs a 7-night window and must work with companion off. ADR 0012: the consumer (goal) owns the interface; the data owner (biometrics/sleep) implements it. The deficit math (`max(0, goal − hours)` summed, unlogged nights skipped) is deliberately identical to `FlagEvaluator.sleepDebt` — keep the comments cross-referencing it.

- [ ] **Step 1: Write the port interface**

```java
package io.mrkuhne.mezo.feature.goal.engine.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): the adaptive review asks "is the owner in sleep debt?" without
 * depending on companion (which owns the flag variant and may be switched off). Implemented in
 * feature/biometrics/sleep. Window/thresholds come from {@code mezo.goal.adaptive.*}.
 */
public interface SleepAdequacyPort {

    /** Cumulative sleep deficit over the configured window ≥ threshold (small-n gated). */
    boolean sleepDebted(UUID userId, LocalDate today);
}
```

- [ ] **Step 2: Write the failing adapter IT**

Follow the file layout of an existing sleep IT (find one: `ls backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/`); seed `sleep_log` rows + a `sleep_goal` row through the repositories:

```java
    @Test
    void debtAccumulatesAgainstTheSleepGoal() {
        saveSleepGoal(480); // 8.0 h target
        // 5 logged nights of 6.5 h over the last 7 → deficit 5×1.5 = 7.5 h ≥ 5.0 → debted.
        for (int i = 0; i < 5; i++) {
            saveSleepLog(today.minusDays(i), 6.5);
        }
        assertThat(adapter.sleepDebted(userId, today)).isTrue();
    }

    @Test
    void smallSampleNeverFlags() {
        saveSleepGoal(480);
        saveSleepLog(today, 4.0); // huge deficit but only 1 night < minNights 4
        assertThat(adapter.sleepDebted(userId, today)).isFalse();
    }

    @Test
    void adequateSleepIsNotDebt() {
        saveSleepGoal(480);
        for (int i = 0; i < 7; i++) {
            saveSleepLog(today.minusDays(i), 8.0);
        }
        assertThat(adapter.sleepDebted(userId, today)).isFalse();
    }
```

(Write `saveSleepGoal`/`saveSleepLog` helpers against the real entities — read `SleepLogEntity`/`SleepGoalEntity` setters first; `durationH` is the hours field.)

- [ ] **Step 3: Run to verify it fails**

Run: `./mvnw test -Dtest=GoalSleepAdequacyAdapterIT`
Expected: COMPILE ERROR — adapter missing.

- [ ] **Step 4: Implement the adapter**

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.engine.port.SleepAdequacyPort;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Sleep-side implementation of the goal engine's {@link SleepAdequacyPort}. Same deficit math as
 * companion's {@code FlagEvaluator.sleepDebt} (sleep_log.date is the WAKE morning, so the row
 * dated today IS last night; a long night never repays a short one; unlogged nights are skipped,
 * never counted debt-free) — but over the adaptive-review window ({@code mezo.goal.adaptive}),
 * independent of the companion switch.
 */
@Component
@RequiredArgsConstructor
public class GoalSleepAdequacyAdapter implements SleepAdequacyPort {

    /** Ghost when no sleep_goal row exists — mirrors the flag config's default-goal-hours. */
    private static final double DEFAULT_GOAL_HOURS = 8.0;

    private final SleepLogRepository sleepLogRepository;
    private final SleepGoalRepository sleepGoalRepository;
    private final GoalEngineProperties props;

    @Override
    public boolean sleepDebted(UUID userId, LocalDate today) {
        GoalEngineProperties.Adaptive cfg = props.adaptive();
        LocalDate from = today.minusDays(cfg.sleepDebtNights() - 1L);

        double goalHours = sleepGoalRepository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .map(minutes -> minutes / 60.0)
            .orElse(DEFAULT_GOAL_HOURS);

        int logged = 0;
        double deficit = 0;
        for (SleepLogEntity log : sleepLogRepository.findAllOwned(userId)) {
            if (log.getDate() == null || log.getDate().isBefore(from) || log.getDate().isAfter(today)
                || log.getDurationH() == null) {
                continue;
            }
            logged++;
            deficit += Math.max(0, goalHours - log.getDurationH().doubleValue());
        }
        return logged >= cfg.sleepDebtMinNights() && deficit >= cfg.sleepDebtDeficitHours();
    }
}
```

(Adjust the repository finder + `durationH` accessor to the real signatures after reading `SleepLogRepository` — if a date-range finder exists, prefer it over `findAllOwned` + filter.)

- [ ] **Step 5: Run the IT**

Run: `./mvnw test -Dtest=GoalSleepAdequacyAdapterIT`
Expected: PASS. ArchUnit store check: this adds a sleep→goal-engine-port compile edge — if the frozen ArchUnit layer rules reject it, the port package is in the wrong place; the store must NOT be hand-edited. Follow how the existing goal→train edge is allowed and mirror it (the port lives with the consumer precisely to keep the dependency direction legal).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/port/SleepAdequacyPort.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/GoalSleepAdequacyAdapter.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/GoalSleepAdequacyAdapterIT.java
git commit -m "feat(goal): sleep-adequacy port for the adaptive review, implemented in biometrics/sleep (mezo-XXXX)"
```

### Task 6: `IntakeAdherencePort` + meal adapter (adherence context)

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/port/IntakeAdherencePort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/GoalIntakeAdherenceAdapter.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/GoalIntakeAdherenceAdapterIT.java`

**Interfaces:**
- Consumes: `FuelDayService.getWeek(UUID userId, LocalDate start)` → `FuelWeekResponse.days[]` each with `targets`/`consumed` `MacroSet` (kcal `BigDecimal`).
- Produces: `IntakeAdherencePort.weekAdherence(UUID userId, LocalDate weekStart)` → `record IntakeAdherence(int loggedDays, int avgIntakeKcal, int avgTargetKcal)` (averages over LOGGED days only; `loggedDays` = days with consumed kcal > 0; all-zero week → `new IntakeAdherence(0, 0, 0)`).

- [ ] **Step 1: Port interface**

```java
package io.mrkuhne.mezo.feature.goal.engine.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): the adaptive review's "did the intake match the plan?" context.
 * Implemented in feature/meal off the FuelDayService week rollup — the goal engine never reads
 * meal tables directly.
 */
public interface IntakeAdherencePort {

    /** Averages over logged days only (a day counts as logged when any meal kcal was recorded). */
    record IntakeAdherence(int loggedDays, int avgIntakeKcal, int avgTargetKcal) {}

    IntakeAdherence weekAdherence(UUID userId, LocalDate weekStart);
}
```

- [ ] **Step 2: Failing IT**

Seed meals via the meal repository/service the way an existing `FuelDayService` IT does (find it: `ls backend/src/test/java/io/mrkuhne/mezo/feature/meal/`), then:

```java
    @Test
    void averagesOverLoggedDaysOnly() {
        LocalDate monday = LocalDate.of(2026, 8, 24);
        seedMeal(monday, 2100);           // one logged day
        seedMeal(monday.plusDays(2), 1900); // second logged day
        IntakeAdherencePort.IntakeAdherence a = adapter.weekAdherence(userId, monday);
        assertThat(a.loggedDays()).isEqualTo(2);
        assertThat(a.avgIntakeKcal()).isEqualTo(2000);
        assertThat(a.avgTargetKcal()).isGreaterThan(0); // config fallback target without a goal
    }

    @Test
    void emptyWeekIsZeroes() {
        IntakeAdherencePort.IntakeAdherence a = adapter.weekAdherence(userId, LocalDate.of(2026, 8, 24));
        assertThat(a).isEqualTo(new IntakeAdherencePort.IntakeAdherence(0, 0, 0));
    }
```

- [ ] **Step 3: Run to verify failure**

Run: `./mvnw test -Dtest=GoalIntakeAdherenceAdapterIT`
Expected: COMPILE ERROR.

- [ ] **Step 4: Implement**

```java
package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Meal-side implementation of {@link IntakeAdherencePort} off the FuelDayService week rollup. */
@Component
@RequiredArgsConstructor
public class GoalIntakeAdherenceAdapter implements IntakeAdherencePort {

    private final FuelDayService fuelDayService;

    @Override
    public IntakeAdherence weekAdherence(UUID userId, LocalDate weekStart) {
        FuelWeekResponse week = fuelDayService.getWeek(userId, weekStart);
        int loggedDays = 0;
        BigDecimal intakeSum = BigDecimal.ZERO;
        BigDecimal targetSum = BigDecimal.ZERO;
        for (FuelDayRollup day : week.getDays()) {
            BigDecimal kcal = day.getConsumed().getKcal();
            if (kcal == null || kcal.signum() <= 0) {
                continue; // unlogged day — absence is missing data, not a zero-kcal day
            }
            loggedDays++;
            intakeSum = intakeSum.add(kcal);
            targetSum = targetSum.add(day.getTargets().getKcal());
        }
        if (loggedDays == 0) {
            return new IntakeAdherence(0, 0, 0);
        }
        return new IntakeAdherence(
            loggedDays,
            intakeSum.divide(BigDecimal.valueOf(loggedDays), 0, RoundingMode.HALF_UP).intValueExact(),
            targetSum.divide(BigDecimal.valueOf(loggedDays), 0, RoundingMode.HALF_UP).intValueExact());
    }
}
```

- [ ] **Step 5: Run the IT**

Run: `./mvnw test -Dtest=GoalIntakeAdherenceAdapterIT`
Expected: PASS. ArchUnit store check as in Task 5.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/port/IntakeAdherencePort.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/GoalIntakeAdherenceAdapter.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/GoalIntakeAdherenceAdapterIT.java
git commit -m "feat(goal): intake-adherence port for the adaptive review, implemented in meal (mezo-XXXX)"
```

### Task 7: `AdaptiveReviewService` — per-user orchestration + payload extension

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalSuggestionPayloadJson.java` (slice 4's record — append fields)
- Modify: `api/feature/goal/goal.yml` (slice 4's `GoalSuggestionPayload` schema — append the same optional fields) + regenerate both clients
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewServiceIT.java`

**Interfaces:**
- Consumes: `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")` (the `FuelDayService.activeGoal` idiom), `WeightTrendService.computeTrend`, `AdaptiveCorrectionService.compute` (Task 4), `SleepAdequacyPort` (Task 5), `IntakeAdherencePort` (Task 6), **slice 4's** `GoalSuggestionService.propose(UUID userId, UUID goalId, String kind, String dedupKey, GoalSuggestionPayloadJson payload)` → entity or `null` when the `(goal_id, dedup_key)` unique index already holds the key (dedup includes decided rows — a dismissed week is never re-proposed; this IS the idempotency mechanism, no extra lookup needed).
- Produces: `AdaptiveReviewService.reviewUser(UUID userId, LocalDate weekStart)` → `boolean` (true iff `propose` returned non-null); `GoalSuggestionPayloadJson` gains nullable weekly-correction fields (below); dedup key format `"weekly:" + weekStart`. The Hungarian rationale goes into the EXISTING `reason` field — no separate rationale field. The stale-accept snapshot is `prescriptionGeneratedAt` (the goal's `prescription.generatedAt` at proposal time — `GoalEntity` has no `updatedAt`, and every material goal change re-evaluates, so the prescription timestamp IS the change marker).

- [ ] **Step 1: Extend `GoalSuggestionPayloadJson`**

Append nullable components after `snapshotTrajectory` (jsonb-additive — existing rows deserialize with nulls):

```java
public record GoalSuggestionPayloadJson(
    String reason,                     // shared: phase_change rationale / weekly_correction Hungarian rationale
    String suggestedTrajectory,
    Integer balanceOverrideKcal,
    Integer fromWeek,
    Integer toWeek,
    UUID mesoId,
    String mesoTitle,
    String snapshotTrajectory,
    // ── weekly_correction fields (slice 5), all null on phase_change payloads ──
    String weekStart,                  // ISO date of the reviewed week's Monday (mirrors the dedup key)
    Integer deltaKcal,
    BigDecimal observedRateKgPerWk,
    BigDecimal targetRateKgPerWk,
    Boolean dampedBySleep,
    Integer adherenceLoggedDays,
    Integer adherenceAvgIntakeKcal,
    Integer adherenceAvgTargetKcal,
    OffsetDateTime prescriptionGeneratedAt // accept-time race guard for weekly_correction
) {
}
```

(Keep slice 4's javadoc; add imports `java.math.BigDecimal`, `java.time.OffsetDateTime`. Update every slice-4 constructor call site with `null` for the nine new components — or, if slice 4 built the record via a builder/factory, extend that instead.)

- [ ] **Step 2: Extend the contract**

In `goal.yml`, `GoalSuggestionPayload` properties gain (all optional, not in `required`):

```yaml
        weekStart: { type: string, format: date, nullable: true, description: 'weekly_correction: reviewed week Monday (mirrors the dedup key)' }
        deltaKcal: { type: integer, nullable: true }
        observedRateKgPerWk: { type: number, nullable: true }
        targetRateKgPerWk: { type: number, nullable: true }
        dampedBySleep: { type: boolean, nullable: true }
        adherenceLoggedDays: { type: integer, nullable: true }
        adherenceAvgIntakeKcal: { type: integer, nullable: true }
        adherenceAvgTargetKcal: { type: integer, nullable: true }
        prescriptionGeneratedAt: { type: string, format: date-time, nullable: true, description: 'weekly_correction accept race guard' }
```

Regenerate both clients: `cd api/generate && npm run generate:api` then `cd frontend && pnpm generate:api`. Mirror the new fields in slice 4's payload mapper (wherever `GoalSuggestionPayloadJson` → `GoalSuggestionPayload` DTO is projected — same-name fields map automatically under MapStruct; verify).

- [ ] **Step 3: Failing IT**

Two core cases (seed via repositories, `GoalEngineRecomputeIT`-style fixtures — read that file for the seeding helpers):

```java
    @Test
    void divergentTrendProposesAWeeklyCorrection() {
        seedActiveCutGoalWithProfile();       // rate 0.6 %BW/wk
        seedDenseWeighInsTrendingAt(-0.2);    // ≥21 days, ≥4/wk → FULL sufficiency, too slow
        boolean proposed = adaptiveReviewService.reviewUser(userId, LocalDate.of(2026, 8, 24));
        assertThat(proposed).isTrue();
        GoalSuggestionEntity s = suggestionRepository
            .findByGoalIdAndKindAndStatus(goalId, "weekly_correction", "proposed").orElseThrow();
        assertThat(s.getDedupKey()).isEqualTo("weekly:2026-08-24");
        assertThat(s.getPayload().deltaKcal()).isEqualTo(-120);
        assertThat(s.getPayload().reason()).isNotBlank();
    }

    @Test
    void sameWeekIsIdempotentViaTheDedupIndex() {
        seedActiveCutGoalWithProfile();
        seedDenseWeighInsTrendingAt(-0.2);
        LocalDate week = LocalDate.of(2026, 8, 24);
        adaptiveReviewService.reviewUser(userId, week);
        // propose returns null on the (goal_id, dedup_key) collision → reviewUser false.
        assertThat(adaptiveReviewService.reviewUser(userId, week)).isFalse();
    }
```

(Adapt the repository finder to slice 4's landed `GoalSuggestionRepository` — any owned finder that reaches the row works.)

- [ ] **Step 4: Run to verify failure**

Run: `./mvnw test -Dtest=AdaptiveReviewServiceIT`
Expected: COMPILE ERROR.

- [ ] **Step 5: Implement**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort;
import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort.IntakeAdherence;
import io.mrkuhne.mezo.feature.goal.engine.port.SleepAdequacyPort;
import io.mrkuhne.mezo.feature.goal.engine.service.AdaptiveCorrectionService.Correction;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalSuggestionPayloadJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.goal.service.GoalSuggestionService; // slice 4
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The Monday adaptive review (diet-plan slice 5): for the owner's active goal, compare the
 * observed EWMA rate to the target rate and propose a smoothed weekly_correction suggestion
 * (suggest + approve — this NEVER writes a target itself). Gates: an active evaluated goal,
 * trend sufficiency ≥ provisional (inside AdaptiveCorrectionService), dead-band, and per-week
 * idempotency via the (goal_id, dedup_key) unique index — propose returns null on a dedup hit,
 * decided rows included, so a dismissed week is never re-proposed.
 */
@Service
@RequiredArgsConstructor
public class AdaptiveReviewService {

    private static final String KIND_WEEKLY_CORRECTION = "weekly_correction";
    private static final String STATUS_ACTIVE = "active";

    private final GoalRepository goalRepository;
    private final WeightTrendService weightTrendService;
    private final AdaptiveCorrectionService correctionService;
    private final SleepAdequacyPort sleepAdequacy;
    private final IntakeAdherencePort intakeAdherence;
    private final GoalSuggestionService suggestionService; // slice 4

    /** Review one user's active goal for the week starting {@code weekStart}; true = proposed. */
    @Transactional
    public boolean reviewUser(UUID userId, LocalDate weekStart) {
        GoalEntity goal = goalRepository
            .findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE)
            .stream().findFirst().orElse(null);
        if (goal == null || goal.getPrescription() == null) {
            return false; // nothing to correct without an evaluated active goal
        }

        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        boolean sleepDebted = sleepAdequacy.sleepDebted(userId, weekStart);
        Optional<Correction> correction = correctionService.compute(goal, trend, sleepDebted);
        if (correction.isEmpty()) {
            return false;
        }

        Correction c = correction.get();
        IntakeAdherence adherence = intakeAdherence.weekAdherence(userId, weekStart.minusDays(7));

        // Weekly-correction payload: phase_change-only components null, reason carries the
        // Hungarian rationale, prescriptionGeneratedAt is the accept-time race-guard snapshot.
        GoalSuggestionPayloadJson payload = new GoalSuggestionPayloadJson(
            c.rationaleHu(), null, null, null, null, null, null, null,
            weekStart.toString(), c.deltaKcal(), c.observedRateKgPerWk(), c.targetRateKgPerWk(),
            c.dampedBySleep(), adherence.loggedDays(), adherence.avgIntakeKcal(),
            adherence.avgTargetKcal(), goal.getPrescription().generatedAt());

        return suggestionService.propose(
            userId, goal.getId(), KIND_WEEKLY_CORRECTION, "weekly:" + weekStart, payload) != null;
    }
}
```

- [ ] **Step 6: Run the IT**

Run: `./mvnw test -Dtest=AdaptiveReviewServiceIT`
Expected: PASS. ArchUnit store check.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewService.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalSuggestionPayloadJson.java \
        api/feature/goal/goal.yml api/generate/ frontend/src/data/_client/ \
        backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewServiceIT.java
git commit -m "feat(goal): adaptive review orchestration — weekly_correction proposals via the suggestion dedup index (mezo-XXXX)"
```

### Task 8: `AdaptiveReviewJob` — the Monday cron shell

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewJob.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewJobTest.java` (plain unit test with mocks — the job is a loop shell; the logic ITs live in Task 7)

**Interfaces:**
- Consumes: `AppUserRepository.findAll()` (the `WeeklyReviewJob` idiom), `AdaptiveReviewService.reviewUser`, `FeaturesConfiguration.ADAPTIVE_REVIEW_JOB_SWITCH`, cron `mezo.goal.adaptive.cron`.
- Produces: the scheduled bean; week anchor `LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))` (the CURRENT week's Monday — the review runs Monday morning and reviews the trend as of now; the adherence context inside the service looks back one week from it).

- [ ] **Step 1: Failing unit test**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdaptiveReviewJobTest {

    @Test
    void runsEveryUserAndIsolatesFailures() {
        AppUserRepository users = mock(AppUserRepository.class);
        AdaptiveReviewService service = mock(AdaptiveReviewService.class);
        AppUserEntity a = user(); AppUserEntity b = user();
        when(users.findAll()).thenReturn(List.of(a, b));
        when(service.reviewUser(eq(a.getId()), any())).thenThrow(new RuntimeException("boom"));

        new AdaptiveReviewJob(users, service).run();

        verify(service).reviewUser(eq(b.getId()), any()); // b still reviewed despite a's failure
    }

    private static AppUserEntity user() {
        AppUserEntity u = new AppUserEntity();
        u.setId(UUID.randomUUID());
        return u;
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `./mvnw test -Dtest=AdaptiveReviewJobTest`
Expected: COMPILE ERROR.

- [ ] **Step 3: Implement (the `WeeklyReviewJob` idiom verbatim)**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Monday adaptive-review sweep (diet-plan slice 5) — the {@code WeeklyReviewJob} idiom: per-user
 * failures isolated, idempotent (AdaptiveReviewService skips an already-reviewed week), the bean
 * absent when the switch is off. Suggest + approve: the job only ever proposes.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADAPTIVE_REVIEW_JOB_SWITCH, havingValue = "true")
public class AdaptiveReviewJob {

    private final AppUserRepository appUserRepository;
    private final AdaptiveReviewService adaptiveReviewService;

    @Scheduled(cron = "${mezo.goal.adaptive.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int proposed = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (adaptiveReviewService.reviewUser(user.getId(), weekStart)) {
                    proposed++;
                }
            } catch (Exception e) {
                log.warn("Adaptive review failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Adaptive-review run for {}: {} correction(s) proposed", weekStart, proposed);
    }
}
```

- [ ] **Step 4: Run tests**

Run: `./mvnw test -Dtest=AdaptiveReviewJobTest`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewJob.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/AdaptiveReviewJobTest.java
git commit -m "feat(goal): Monday adaptive-review job (mezo-XXXX)"
```

### Task 9: Accept path — apply the correction, guard the race, re-evaluate

**Files:**
- Modify: slice 4's `GoalSuggestionService` (`backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java` — adapt path to slice 4's landed location): add the `weekly_correction` branch to the accept dispatch
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionServiceIT.java` (extend slice 4's IT)

**Interfaces:**
- Consumes: slice 4's per-kind accept dispatch — a switch on the entity's `kind` using slice 4's constants `KIND_PHASE_CHANGE` / `KIND_WEEKLY_CORRECTION`; slice 4 already guards `phase_change` via `snapshotTrajectory`. The typed `GoalSuggestionPayloadJson` (extended in Task 7) is read DIRECTLY off `suggestion.getPayload()` — no conversion step. Plus `GoalEngineService.evaluate`, `SystemMessage`/`SystemRuntimeErrorException` (the `GoalEngineService` 404 idiom).
- Produces: a `KIND_WEEKLY_CORRECTION` branch in that switch: sets `goal.balanceAdjustmentKcal = (current ?? 0) + payload.deltaKcal()`, re-evaluates (the fresh prescription then carries `basis="adaptive"` via Task 3), marks the suggestion accepted; a stale `prescriptionGeneratedAt` (this kind's race guard, analogous to phase_change's `snapshotTrajectory`) → suggestion marked `superseded` + `SystemRuntimeErrorException(SystemMessage.error("GOAL_SUGGESTION_STALE"), HttpStatus.CONFLICT)` — the endpoint's documented 409.

- [ ] **Step 1: Failing IT cases (extend slice 4's IT)**

```java
    @Test
    void acceptingAWeeklyCorrectionAppliesTheAdjustmentAndFlipsBasis() {
        GoalEntity goal = seedEvaluatedActiveCutGoal();
        UUID sid = proposeWeeklyCorrection(goal, -120); // helper: propose with current rx.generatedAt
        suggestionService.accept(userId, goal.getId(), sid);

        GoalEntity reloaded = goalRepository.findById(goal.getId()).orElseThrow();
        assertThat(reloaded.getBalanceAdjustmentKcal()).isEqualTo(-120);
        assertThat(reloaded.getPrescription().basis()).isEqualTo("adaptive");
        // second accepted correction accumulates:
        UUID sid2 = proposeWeeklyCorrection(reloaded, -60);
        suggestionService.accept(userId, goal.getId(), sid2);
        assertThat(goalRepository.findById(goal.getId()).orElseThrow().getBalanceAdjustmentKcal())
            .isEqualTo(-180);
    }

    @Test
    void staleSnapshotConflictsAndSupersedes() {
        GoalEntity goal = seedEvaluatedActiveCutGoal();
        UUID sid = proposeWeeklyCorrection(goal, -120);
        goalEngineService.evaluate(userId, goal.getId()); // goal moved → rx.generatedAt changed

        assertThatThrownBy(() -> suggestionService.accept(userId, goal.getId(), sid))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("GOAL_SUGGESTION_STALE");
        assertThat(suggestionRepository.findById(sid).orElseThrow().getStatus()).isEqualTo("superseded");
    }
```

- [ ] **Step 2: Run to verify failure**

Run: `./mvnw test -Dtest=GoalSuggestionServiceIT`
Expected: FAIL — accept has no `weekly_correction` branch.

- [ ] **Step 3: Implement the accept branch (inside slice 4's `@Transactional accept`, extending its per-kind switch alongside the existing `KIND_PHASE_CHANGE` case)**

```java
        case KIND_WEEKLY_CORRECTION -> {
            GoalSuggestionPayloadJson payload = suggestion.getPayload(); // typed jsonb — read directly
            // Race guard (spec §6.8), this kind's analogue of phase_change's snapshotTrajectory:
            // every material goal change re-evaluates, so a differing prescription timestamp means
            // the numbers this suggestion was computed from are gone.
            OffsetDateTime rxAt = goal.getPrescription() == null
                ? null : goal.getPrescription().generatedAt();
            if (payload.prescriptionGeneratedAt() == null || rxAt == null
                || !payload.prescriptionGeneratedAt().isEqual(rxAt)) {
                suggestion.setStatus(STATUS_SUPERSEDED);
                suggestion.setDecidedAt(OffsetDateTime.now());
                throw new SystemRuntimeErrorException(
                    SystemMessage.error("GOAL_SUGGESTION_STALE").build(), HttpStatus.CONFLICT);
            }
            int current = goal.getBalanceAdjustmentKcal() == null ? 0 : goal.getBalanceAdjustmentKcal();
            goal.setBalanceAdjustmentKcal(current + payload.deltaKcal());
            goalEngineService.evaluate(userId, goal.getId());
        }
```

(`STATUS_SUPERSEDED` / decidedAt handling follows slice 4's constants. Register the `GOAL_SUGGESTION_STALE` `SystemMessage` key wherever slice 4 registered its own keys — mirror it; the endpoint contract already documents 409 on accept.)

- [ ] **Step 4: Run the IT**

Run: `./mvnw test -Dtest=GoalSuggestionServiceIT`
Expected: PASS (slice 4's existing cases + the two new ones). ArchUnit store check.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/goal/service/GoalSuggestionServiceIT.java
git commit -m "feat(goal): weekly_correction accept — apply balance adjustment, stale-snapshot conflict (mezo-XXXX)"
```

### Task 10: FE — weekly_correction card body + mock fixture, both modes

**Files:**
- Modify: `frontend/src/data/me/goals.ts` (mock suggestions array — slice 4 established it; add a `weekly_correction` entry)
- Modify: `frontend/src/features/me/components/GoalSuggestionCard.tsx` (slice 4's card): render the `weekly_correction` payload variant. `DietSuggestionBanner` needs no change — it renders whatever open suggestion the hooks serve.
- Test: `frontend/src/features/me/components/GoalSuggestionCard.test.tsx` (extend slice 4's file)

**Interfaces:**
- Consumes: slice 4's hooks `useGoalSuggestions` / `useSuggestionActions` and `GoalSuggestionCard`; `GoalSuggestionPayload` DTO fields regenerated in Task 7 (`reason` carries the Hungarian rationale — there is no separate rationale field).
- Produces: a `weekly_correction` card variant showing delta + rates + adherence + the damping note; Hungarian copy.

- [ ] **Step 1: Failing component test**

```tsx
test('weekly correction card shows the delta, rates, and sleep damping', () => {
  render(<GoalSuggestionCard suggestion={weeklyCorrectionSuggestion} onAccept={vi.fn()} onDismiss={vi.fn()} />)
  expect(screen.getByText(/−120 kcal\/nap/)).toBeInTheDocument()
  expect(screen.getByText(/mért.*-0\.20.*cél.*-0\.48/i)).toBeInTheDocument()
  expect(screen.getByText(/alváshiány/i)).toBeInTheDocument() // only when dampedBySleep
})
```

(Fixture `weeklyCorrectionSuggestion`: kind `weekly_correction`, payload `{ reason: 'A mért trend -0.20 kg/hét, a cél -0.48 kg/hét — a heti felülvizsgálat -60 kcal/nap csökkentést javasol. Az alváshiány miatt a deficit-mélyítés a felére tompítva.', weekStart: '2026-08-24', deltaKcal: -120, observedRateKgPerWk: -0.2, targetRateKgPerWk: -0.48, dampedBySleep: true, adherenceLoggedDays: 5, adherenceAvgIntakeKcal: 2210, adherenceAvgTargetKcal: 2150, prescriptionGeneratedAt: '2026-08-20T06:00:00Z' }` — the phase_change-only fields stay absent. Format the minus sign the way the component actually renders it — adjust the assertion to the implementation's formatter.)

- [ ] **Step 2: Run to verify failure**

Run: `cd frontend && pnpm test src/features/me/components/GoalSuggestionCard.test.tsx`
Expected: FAIL — the card has no weekly_correction branch (or renders raw payload).

- [ ] **Step 3: Implement the card variant**

Inside slice 4's card, branch on `suggestion.kind`:

```tsx
{suggestion.kind === 'weekly_correction' && payload && (
  <div className="space-y-1">
    <p className="text-sm font-medium">
      Heti felülvizsgálat: {payload.deltaKcal > 0 ? '+' : '−'}{Math.abs(payload.deltaKcal)} kcal/nap
      {payload.deltaKcal < 0 ? ' (mélyebb deficit)' : ' (több étel)'}
    </p>
    <p className="text-xs text-muted-foreground">
      Mért ütem {payload.observedRateKgPerWk} kg/hét · cél {payload.targetRateKgPerWk} kg/hét
      {payload.adherenceLoggedDays > 0 &&
        ` · loggolva ${payload.adherenceLoggedDays}/7 nap (átlag ${payload.adherenceAvgIntakeKcal} / cél ${payload.adherenceAvgTargetKcal} kcal)`}
    </p>
    {payload.dampedBySleep && (
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Alváshiány miatt a javasolt lépés a felére tompítva.
      </p>
    )}
  </div>
)}
```

(Match the card's existing markup/utility classes — copy the phase_change variant's structure, not this sketch, if they differ.)

- [ ] **Step 4: Mock fixture**

In `goals.ts`, add a `weekly_correction` entry to slice 4's mock suggestions export (exact fixture from Step 1) so mock mode exercises the new variant.

- [ ] **Step 5: Run both modes**

Run: `cd frontend && pnpm test src/features/me && VITE_USE_MOCK=true pnpm test src/features/me`
Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/me/ frontend/src/data/me/
git commit -m "feat(me): weekly-correction suggestion card + mock fixture (mezo-XXXX)"
```

### Task 11: Docs + CODEMAP + gates

**Files:**
- Modify: `docs/features/goal-engine.md` (§5 bridges table + §9 deferred list: adaptive TDEE is no longer deferred — `basis="adaptive"` is live via accepted weekly corrections; document the new recompute-relevant column, the two ports, the job, and the correction math with its sign convention)
- Modify: `docs/features/fuel.md` §5 if the adherence port is worth a seam row (one line)
- Regenerate: CODEMAP

**Interfaces:** none — documentation closure.

- [ ] **Step 1: Update `goal-engine.md`** — rewrite the stale §9 "Phase 3 adaptive TDEE (blocked on Fuel Slice C)" entry into the shipped description; add `balance_adjustment_kcal`, `AdaptiveCorrectionService`/`AdaptiveReviewService`/`AdaptiveReviewJob`, `SleepAdequacyPort`/`IntakeAdherencePort`, the `mezo.goal.adaptive.*` config table rows, and the corrected sign convention with the five worked examples.

- [ ] **Step 2: Regenerate CODEMAP**

Run: `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`
Expected: check passes.

- [ ] **Step 3: Focused verification sweep**

Run:
```bash
./mvnw test -Dtest='AdaptiveCorrectionServiceTest,AdaptiveReviewServiceIT,AdaptiveReviewJobTest,GoalSuggestionServiceIT,GoalProjectionServiceIT,GoalEvaluationServiceIT,GoalSleepAdequacyAdapterIT,GoalIntakeAdherenceAdapterIT'
cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```
Expected: all green (FE full suite is cheap; backend stays focused — CI runs the full IT suite on the PR). `git status`: ArchUnit store intact, no stray generated files.

- [ ] **Step 4: Commit**

```bash
git add docs/ CODEMAP.md docs/CODEMAP.md 2>/dev/null; git add -u
git commit -m "docs(goal): adaptive review shipped — goal-engine.md + CODEMAP (mezo-XXXX)"
```

---

## Self-review notes (already applied)

- **Spec deviation, deliberate:** spec §6.6 wrote `delta = (observedRate − targetRate) × 7700/7`; the worked examples show that sign is inverted for the intended behavior (cut-too-slow must produce a NEGATIVE kcal delta). This plan uses `(target − observed)` and the examples are the source of truth.
- **Spec's "sleep debt flag reuse":** implemented as a goal-owned port with the same math, not a companion dependency — `FlagEvaluator` is switch-gated and windowed differently (3 vs 7 nights). Rationale recorded in Task 5.
- **`goal.updatedAt` does not exist** — the race guard uses `prescription.generatedAt`, which changes on every material goal mutation because all mutation paths re-evaluate.
- **Payload home:** slice 4's `GoalSuggestionEntity.payload` is the strongly typed `GoalSuggestionPayloadJson` — this slice appends nullable weekly-correction components to that record (Task 7) instead of introducing a separate payload type; the Hungarian rationale rides the shared `reason` field.
- **Idempotency:** slice 4's `(goal_id, dedup_key)` unique index (dedup includes decided rows) is the sole per-week guard — `dedupKey = "weekly:" + weekStart`; no payload-based exists query.
- **Type consistency:** `Correction` (Task 4) → `GoalSuggestionPayloadJson` weekly fields (Task 7) → accept branch reads (Task 9) → FE fixture/card (Task 10) use identical names (`deltaKcal`, `observedRateKgPerWk`, `targetRateKgPerWk`, `dampedBySleep`, `adherence*`, `prescriptionGeneratedAt`); `KIND_WEEKLY_CORRECTION = "weekly_correction"` matches slice 4's constant vocabulary, and the accept dispatch is the per-kind switch shared with `KIND_PHASE_CHANGE`.
