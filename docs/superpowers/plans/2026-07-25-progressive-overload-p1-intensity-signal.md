# Progressive Overload — Plan 1: RIR-aware intensity engine + in-workout signal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing double-progression engine **RIR-aware + deload-aware** and surface its recommendation in-workout — a merged `Progresszió` banner on the active set card, a delta chip on the prep card, and a day-level overload summary on the PrepHero.

**Architecture:** Backend — a pure `ProgressionDecider` (RIR matrix) drives `SetRecommendationService`, which now emits a structured `ProgressionSignal` per exercise; `WorkoutService.getToday` attaches it (+ a day-level `OverloadSummary`), reading the deload flag from the active meso's `phaseCurve[currentWeek]`. Frontend — the signal flows through the existing `@/data/hooks` boundary into a new presentational `ProgressionBanner` (replacing the `.aistrip` rationale strip) plus prep-card/PrepHero additions. All behind the **existing** `mezo.feature.hypertrophy-drive` switch; mock mode renders from fixtures with byte-parity.

**Tech Stack:** Java 21 · Spring Boot 4 · Maven · Postgres (Liquibase) · OpenAPI contract-first · React 19 + Vite + Tailwind v4 · TanStack Query · Vitest.

**Spec:** [`docs/superpowers/specs/2026-07-25-progressive-overload-design.md`](../specs/2026-07-25-progressive-overload-design.md) — this plan implements **Pillar 1** (§5.1 intensity engine) + **§8 set-card/prep surfacing**. Volume engine + meso-overview (Plan 2) and the challenge tie-in (Plan 3) are separate.

## Global Constraints

- **Base package:** `io.mrkuhne.mezo`. **PKs:** UUID. **Build:** Maven, always `./mvnw clean …` (Lombok+MapStruct incremental compile is flaky).
- **Contract-first:** edit `api/feature/train/train.yml` **before** any boundary code; never hand-write boundary DTOs. Merge with `cd api/generate && npm run generate:api`; FE types via `cd frontend && pnpm generate:api`; backend Java DTOs regenerate in `./mvnw generate-sources`.
- **Config:** any tunable via `@Validated` `*Properties` under `mezo.*`; **never `@Value`**. (No new tunables in this plan — increments already live in `HypertrophyProperties`.)
- **Feature switch:** reuse `mezo.feature.hypertrophy-drive.enabled` (`FeaturesConfiguration.HYPERTROPHY_DRIVE_SWITCH`, `HypertrophyDriveGate`). Off → `progression`/`overloadSummary` null → FE falls back to the existing ad-hoc surface unchanged.
- **Backend tests:** integration-first, AssertJ only, no mocks/`@MockBean`/H2 in ITs; data via `*Populator`. **Pure** logic (the decider) may be a plain JUnit unit test (no Spring context). ITs run against the fixed `mezo_test` DB (compose up) or `-Dmezo.test.use-testcontainers=true`.
- **Frontend:** feature code imports hooks from `@/data/hooks` only; deep absolute `@/*` imports, no relative `../`, tests colocated. **Both modes must stay green:** `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`.
- **Commits:** conventional subject carrying the bd id, e.g. `feat(train): … (mezo-5pfe)`.
- **HU copy:** all user-facing strings Hungarian; the rationale strings are defined verbatim in Task 2.

## File Structure

- `api/feature/train/train.yml` — **modify**: add `ProgressionSignal` + `OverloadSummary` schemas; add `progression` to `TodayExercise`, `overloadSummary` to `WorkoutTodayResponse`.
- `backend/…/feature/train/service/ProgressionDecider.java` — **create**: pure RIR-matrix decision (no Spring). One responsibility: given a reference set + recipe bounds + deload flag, decide the lever, base weight, working reps, deltas, and HU rationale.
- `backend/…/feature/train/service/Prescription.java` — **modify**: add `ProgressionSignal progression`.
- `backend/…/feature/train/service/SetRecommendationService.java` — **modify**: use `ProgressionDecider`; build the `ProgressionSignal`; new `deloadWeek` param.
- `backend/…/feature/train/service/WorkoutService.java` — **modify**: pass `deloadWeek`; attach `progression` per exercise; compute `overloadSummary`.
- `backend/…/test/…/feature/train/service/ProgressionDeciderTest.java` — **create**: pure unit test, one per matrix branch.
- `backend/…/test/…/feature/train/ProgressionSignalIT.java` — **create**: HTTP-level `getToday` carries `progression` + `overloadSummary`; off → null.
- `frontend/src/data/types.ts` — **modify**: `ProgressionSignal`, `OverloadSummary` domain types; add `progression?` to `LoggedWorkoutExercise`, `overloadSummary?` to `WorkoutPlan`.
- `frontend/src/data/train/trainHooks.ts` — **modify**: map `progression` + `overloadSummary` in `toWorkoutPlan`.
- `frontend/src/data/train/train.ts` — **modify**: add demo `progression`/`overloadSummary` to the `trainWorkout` mock fixture.
- `frontend/src/features/train/components/ProgressionBanner.tsx` (+ `.test.tsx`) — **create**: presentational banner, 3 states.
- `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` — **modify**: render `ProgressionBanner` in place of the `.aistrip` block (fallback kept for progression-null rationale).
- `frontend/src/features/train/components/PrepExerciseCard.tsx` — **modify**: per-exercise delta chip.
- `frontend/src/features/train/components/PrepHero.tsx` — **modify**: day-level overload chip.
- `frontend/src/index.css` / `prototype.css` — **modify**: `.pobanner` CSS family.

---

### Task 1: API contract — `ProgressionSignal` + `OverloadSummary`

**Files:**
- Modify: `api/feature/train/train.yml`

**Interfaces:**
- Produces (backend DTOs after generate): `io.mrkuhne.mezo.api.dto.ProgressionSignal` with `LeverEnum {WEIGHT("weight"), REP("rep"), HOLD("hold"), DELOAD("deload")}`, fields `lever`, `deltaKg`(BigDecimal, nullable), `deltaReps`(Integer, nullable), `targetWeightKg`(BigDecimal, nullable), `targetReps`(Integer), `rationale`(String); `io.mrkuhne.mezo.api.dto.OverloadSummary` with `weightUp`, `repUp`, `hold` (Integer). `TodayExercise.progression` (nullable), `WorkoutTodayResponse.overloadSummary` (nullable).
- Produces (FE types after generate): same on `components['schemas']['ProgressionSignal' | 'OverloadSummary']`.

- [ ] **Step 1: Add the two schemas** under `components.schemas` in `api/feature/train/train.yml` (place right after `PrescribedSet`):

```yaml
    ProgressionSignal:
      type: object
      description: >-
        Per-exercise progressive-overload recommendation for TODAY vs the last completed
        session. Null when there is no meaningful progression (first session / no history) —
        the FE then shows the start-weight pill instead of the banner.
      required:
        - lever
        - targetReps
        - rationale
      properties:
        lever:
          type: string
          enum: [weight, rep, hold, deload]
          description: Which lever moved — weight up/down, rep build, hold/consolidate, or deload back-off.
        deltaKg:
          type: number
          nullable: true
          description: Signed kg change vs last week (+ up, − deload/back-off); null on rep/hold.
        deltaReps:
          type: integer
          nullable: true
          description: Rep-target change vs last week (e.g. +1); null on weight/hold/deload.
        targetWeightKg:
          type: number
          nullable: true
        targetReps:
          type: integer
        rationale:
          type: string
          description: Short HU explanation (e.g. "Múlt hét könnyen ment (RIR 3) → +1 rep").
    OverloadSummary:
      type: object
      description: Day-level count of how many exercises move via each lever (PrepHero chip).
      required: [weightUp, repUp, hold]
      properties:
        weightUp:
          type: integer
        repUp:
          type: integer
        hold:
          type: integer
```

- [ ] **Step 2: Reference them** — in `TodayExercise.properties` add (after `rationale`):

```yaml
        progression:
          allOf:
            - $ref: '#/components/schemas/ProgressionSignal'
          nullable: true
          description: RIR-aware overload recommendation; null on first session / switch off.
```

and in `WorkoutTodayResponse.properties` add (after `weekDoneDates`):

```yaml
        overloadSummary:
          allOf:
            - $ref: '#/components/schemas/OverloadSummary'
          nullable: true
          description: Day-level overload summary; null when hypertrophy-drive is off.
```

- [ ] **Step 3: Regenerate contract + verify backend DTOs compile**

Run:
```bash
cd api/generate && npm run generate:api
cd ../../backend && ./mvnw -q clean generate-sources
```
Expected: no errors; `backend/target/generated-sources/**/ProgressionSignal.java` and `OverloadSummary.java` exist.

- [ ] **Step 4: Regenerate FE types**

Run: `cd frontend && pnpm generate:api`
Expected: `git diff src/data/_client/api.gen.ts` shows `ProgressionSignal` + `OverloadSummary` + the two new nullable fields.

- [ ] **Step 5: Commit**

```bash
git add api/ backend/pom.xml frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): ProgressionSignal + OverloadSummary contract (mezo-5pfe)"
```

---

### Task 2: `ProgressionDecider` — pure RIR matrix

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ProgressionDecider.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ProgressionDeciderTest.java`

**Interfaces:**
- Produces: `ProgressionDecider.decide(RefSet ref, int repMin, int repMax, int targetRir, BigDecimal inc, BigDecimal plateStep, boolean deloadWeek)` → `Decision`. `RefSet(BigDecimal weightKg, int reps, Integer rir)`. `Decision(Lever lever, BigDecimal base, int workingReps, BigDecimal deltaKg, Integer deltaReps, String rationale)`. `enum Lever {WEIGHT, REP, HOLD, DELOAD}`. **Precondition:** `ref.weightKg != null` (weighted history) — weightless/first-session cases are handled by the caller, not this class.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Decision;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.Lever;
import io.mrkuhne.mezo.feature.train.service.ProgressionDecider.RefSet;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class ProgressionDeciderTest {

    private static final BigDecimal INC = new BigDecimal("2.5");
    private static final BigDecimal STEP = new BigDecimal("2.5");

    private static RefSet ref(String kg, int reps, Integer rir) {
        return new RefSet(new BigDecimal(kg), reps, rir);
    }

    @Test
    void decide_shouldAddWeight_whenRepsAtTopOfRange() {
        Decision d = ProgressionDecider.decide(ref("60", 8, 2), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(6);
        assertThat(d.deltaKg()).isEqualByComparingTo("2.5");
        assertThat(d.deltaReps()).isNull();
    }

    @Test
    void decide_shouldBuildRep_whenInRangeWithRirSlack() {
        Decision d = ProgressionDecider.decide(ref("62.5", 8, 3), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.REP);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(9);
        assertThat(d.deltaKg()).isNull();
        assertThat(d.deltaReps()).isEqualTo(1);
    }

    @Test
    void decide_shouldHold_whenInRangeOnTargetRir() {
        Decision d = ProgressionDecider.decide(ref("62.5", 7, 2), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("62.5");
        assertThat(d.workingReps()).isEqualTo(7);
        assertThat(d.deltaReps()).isNull();
    }

    @Test
    void decide_shouldDropWeight_whenBelowRangeAndGrind() {
        Decision d = ProgressionDecider.decide(ref("62.5", 5, 0), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.WEIGHT);
        assertThat(d.base()).isEqualByComparingTo("60");
        assertThat(d.deltaKg()).isEqualByComparingTo("-2.5");
    }

    @Test
    void decide_shouldHold_whenBelowRangeButNotGrind() {
        Decision d = ProgressionDecider.decide(ref("62.5", 5, 3), 6, 8, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
        assertThat(d.base()).isEqualByComparingTo("62.5");
    }

    @Test
    void decide_shouldRegress_whenDeloadWeek() {
        Decision d = ProgressionDecider.decide(ref("60", 8, 2), 6, 8, 2, INC, STEP, true);
        assertThat(d.lever()).isEqualTo(Lever.DELOAD);
        assertThat(d.base()).isEqualByComparingTo("54"); // round(0.9 * 60)
        assertThat(d.deltaKg().signum()).isNegative();
        assertThat(d.rationale()).contains("Deload");
    }

    @Test
    void decide_shouldTreatNullRirAsNeutral() {
        // reps in range, rir unknown → slack 0 → hold (never fabricate an "easy" bump)
        Decision d = ProgressionDecider.decide(ref("62.5", 7, null), 6, 10, 2, INC, STEP, false);
        assertThat(d.lever()).isEqualTo(Lever.HOLD);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw -q clean test -Dtest=ProgressionDeciderTest`
Expected: FAIL — `ProgressionDecider` does not exist (compile error).

- [ ] **Step 3: Write the implementation**

```java
package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Pure RIR-aware double-progression decision (spec §5.1). No Spring, no DB — given the last
 * completed WORKING reference set + the recipe bounds + whether this is a deload week, it
 * decides the lever, the working base weight, the working rep target, the signed deltas, and
 * the HU rationale. Weightless / first-session cases are handled by {@link SetRecommendationService},
 * never here (precondition: {@code ref.weightKg() != null}).
 */
public final class ProgressionDecider {

    private ProgressionDecider() {}

    public enum Lever { WEIGHT, REP, HOLD, DELOAD }

    public record RefSet(BigDecimal weightKg, int reps, Integer rir) {}

    public record Decision(Lever lever, BigDecimal base, int workingReps,
                           BigDecimal deltaKg, Integer deltaReps, String rationale) {}

    public static Decision decide(RefSet ref, int repMin, int repMax, int targetRir,
                                  BigDecimal inc, BigDecimal plateStep, boolean deloadWeek) {
        int rp = ref.reps();
        int rir = ref.rir() != null ? ref.rir() : targetRir; // null RIR → neutral slack
        int slack = rir - targetRir;
        BigDecimal w = ref.weightKg();

        if (deloadWeek) {
            BigDecimal base = round(w.multiply(new BigDecimal("0.9")), plateStep);
            return new Decision(Lever.DELOAD, base, repMin, base.subtract(w), null,
                "Deload hét — visszaveszünk");
        }
        if (rp >= repMax) {
            BigDecimal base = round(w.add(inc), plateStep);
            return new Decision(Lever.WEIGHT, base, repMin, inc, null,
                "Múlt hét " + rp + "×" + strip(w) + " kg a tartomány tetején → +" + strip(inc) + " kg");
        }
        if (rp >= repMin) {
            if (slack >= 1) {
                int reps = Math.min(rp + 1, repMax);
                return new Decision(Lever.REP, w, reps, null, 1,
                    "Múlt hét könnyen ment (RIR " + rir + ") → +1 rep");
            }
            return new Decision(Lever.HOLD, w, rp, null, null,
                "Múlt hét RIR " + rir + " a célon → tartás, konszolidálás");
        }
        // rp < repMin
        if (slack < 0) {
            BigDecimal base = round(w.subtract(inc), plateStep);
            return new Decision(Lever.WEIGHT, base, repMin, inc.negate(), null,
                "Múlt hét " + rp + " rep a cél alatt, grind → −" + strip(inc) + " kg");
        }
        return new Decision(Lever.HOLD, w, repMin, null, null, "Súly tart, cél a tartomány alja");
    }

    private static BigDecimal round(BigDecimal x, BigDecimal step) {
        BigDecimal rounded = x.divide(step, 0, RoundingMode.HALF_UP).multiply(step);
        return rounded.max(BigDecimal.ZERO).min(BigDecimal.valueOf(999));
    }

    private static String strip(BigDecimal x) {
        return x.stripTrailingZeros().toPlainString();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw -q clean test -Dtest=ProgressionDeciderTest`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/ProgressionDecider.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ProgressionDeciderTest.java
git commit -m "feat(train): pure RIR-aware progression decider (mezo-5pfe)"
```

---

### Task 3: `SetRecommendationService` uses the decider + emits `ProgressionSignal`

**Files:**
- Modify: `backend/…/feature/train/service/Prescription.java`
- Modify: `backend/…/feature/train/service/SetRecommendationService.java`
- Test: `backend/…/test/…/feature/train/service/SetRecommendationServiceIT.java` (create)

**Interfaces:**
- Consumes: `ProgressionDecider.decide(...)` (Task 2); `ExerciseHistoryResolver.latestCompletedWorkingSets` (existing); `HypertrophyProperties` (existing).
- Produces: `Prescription(List<PrescribedSet> sets, String rationale, ProgressionSignal progression)`; `SetRecommendationService.prescribe(UUID createdBy, ExerciseEntity ex, boolean deloadWeek)` (new `deloadWeek` param). `progression` is **null** for first-session/anchor/no-history exercises.

- [ ] **Step 1: Extend the `Prescription` record**

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import java.util.List;

/** The engine output for one exercise: the ordered prescribed sets, a short HU rationale, and
 * the structured overload signal (null on first session / no history). */
public record Prescription(List<PrescribedSet> sets, String rationale, ProgressionSignal progression) {}
```

- [ ] **Step 2: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class SetRecommendationServiceIT extends AbstractIntegrationTest {

    @Autowired
    SetRecommendationService service;

    @Test
    void testPrescribe_shouldEmitWeightSignal_whenLastSessionHitTopOfRange() {
        // Given: a bench exercise (6–8 rep, RIR 2) with a completed session logged at 60kg × 8 @ RIR 2
        ExerciseEntity bench = trainData.benchWithCompletedHistory(owner(), "60", 8, 2, 6, 8, 2);

        Prescription p = service.prescribe(owner(), bench, false);

        assertThat(p.progression()).isNotNull();
        assertThat(p.progression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(p.progression().getTargetWeightKg()).isEqualByComparingTo("62.5");
        assertThat(p.progression().getDeltaKg()).isEqualByComparingTo("2.5");
    }

    @Test
    void testPrescribe_shouldEmitNullSignal_whenNoHistoryAndNoAnchor() {
        ExerciseEntity fresh = trainData.exerciseNoHistoryNoAnchor(owner());
        Prescription p = service.prescribe(owner(), fresh, false);
        assertThat(p.progression()).isNull();
        assertThat(p.rationale()).contains("Első alkalom");
    }
}
```

> The `trainData` populator helpers `benchWithCompletedHistory(owner, kg, reps, rir, repMin, repMax, targetRir)` and `exerciseNoHistoryNoAnchor(owner)` are added to the existing Train `*Populator` (per `integration_test_framework.md`: new aggregate → extend the populator; no new table so no `ResetDatabase` change). If a Train populator does not yet expose a completed-instance builder, add one alongside the existing exercise/set factories.

- [ ] **Step 3: Run IT to verify it fails**

Run: `cd backend && docker compose up -d && ./mvnw -q clean test -Dtest=SetRecommendationServiceIT`
Expected: FAIL — `prescribe(owner, ex, boolean)` signature does not exist / `Prescription.progression()` missing.

- [ ] **Step 4: Rewrite `SetRecommendationService.prescribe`**

Replace the method body (`SetRecommendationService.java:28-80`) with:

```java
    public Prescription prescribe(UUID createdBy, ExerciseEntity ex, boolean deloadWeek) {
        ExerciseSetEntity ref = referenceWorkingSet(createdBy, ex);
        BigDecimal inc = props.increment().getOrDefault(ex.getType(), props.defaultIncrement());
        BigDecimal base;
        int workingReps = ex.getRepMax();
        String rationale;
        ProgressionSignal progression = null;

        if (ref != null && ref.getWeightKg() != null) {
            ProgressionDecider.Decision d = ProgressionDecider.decide(
                new ProgressionDecider.RefSet(ref.getWeightKg(), ref.getReps(), ref.getRir()),
                ex.getRepMin(), ex.getRepMax(), ex.getTargetRir(), inc, props.plateStep(), deloadWeek);
            base = d.base();
            workingReps = d.workingReps();
            rationale = d.rationale();
            progression = ProgressionSignal.builder()
                .lever(ProgressionSignal.LeverEnum.fromValue(d.lever().name().toLowerCase()))
                .deltaKg(d.deltaKg())
                .deltaReps(d.deltaReps())
                .targetWeightKg(base)
                .targetReps(workingReps)
                .rationale(rationale)
                .build();
        } else if (ref != null) {
            base = null; // weightless history (plyo/bodyweight) — progress reps
            workingReps = Math.min(ref.getReps() + 1, ex.getRepMax());
            rationale = "Testsúlyos — ismétlésre progresszálunk";
            progression = ProgressionSignal.builder()
                .lever(ProgressionSignal.LeverEnum.REP)
                .deltaReps(1)
                .targetReps(workingReps)
                .rationale(rationale)
                .build();
        } else if (ex.getAnchorWeightKg() != null) {
            base = roundClamp(ex.getAnchorWeightKg());
            rationale = "Kezdő súly (anchor)";
        } else {
            base = null;
            rationale = "Első alkalom — add meg a súlyt";
        }

        List<PrescribedSet> sets = new ArrayList<>();
        for (int i = 0; i < ex.getWarmupSets(); i++) {
            HypertrophyProperties.Ramp r = props.warmupRamp().get(Math.min(i, props.warmupRamp().size() - 1));
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WARMUP)
                .targetWeightKg(base == null ? null : roundClamp(base.multiply(BigDecimal.valueOf(r.pct()))))
                .targetReps(Math.max(1, (int) Math.round(ex.getRepMax() * r.repsFactor())))
                .targetRIR(null)
                .build());
        }
        for (int j = 0; j < ex.getWorkingSets(); j++) {
            sets.add(PrescribedSet.builder()
                .kind(PrescribedSet.KindEnum.WORKING)
                .targetWeightKg(base)
                .targetReps(workingReps)
                .targetRIR(ex.getTargetRir())
                .build());
        }
        return new Prescription(sets, rationale, progression);
    }
```

Add the import `import io.mrkuhne.mezo.api.dto.ProgressionSignal;` at the top.

> Note: the working loop now uses `workingReps` (was `ex.getRepMax()`) so rep-progression targets carry through; warmup reps still key off `repMax`. The `strip`/`roundClamp` helpers stay.

- [ ] **Step 5: Run IT to verify it passes**

Run: `cd backend && ./mvnw -q clean test -Dtest=SetRecommendationServiceIT`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/Prescription.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SetRecommendationService.java \
        backend/src/test/
git commit -m "feat(train): RIR-aware prescription emits ProgressionSignal (mezo-5pfe)"
```

---

### Task 4: `WorkoutService.getToday` attaches `progression` + `overloadSummary`

**Files:**
- Modify: `backend/…/feature/train/service/WorkoutService.java`
- Test: `backend/…/test/…/feature/train/ProgressionSignalIT.java` (create)

**Interfaces:**
- Consumes: `setRecommendationService.prescribe(createdBy, e, deloadWeek)` (Task 3); `activeMeso.getPhaseCurve()`/`getCurrentWeek()` (existing entity).
- Produces: `WorkoutTodayResponse.overloadSummary` populated + each `TodayExercise.progression` set when the hypertrophy gate is on.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.train;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;

class ProgressionSignalIT extends ApiIntegrationTest {

    @Test
    void testGetToday_shouldCarryProgressionAndOverloadSummary_whenHistoryExists() throws Exception {
        trainData.activeMesoWithBenchHistory(owner(), "60", 8, 2); // MAV week, bench 60×8@RIR2

        getAuth("/api/train/workouts/today")
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.exercises[0].progression.lever").value("weight"))
            .andExpect(jsonPath("$.exercises[0].progression.targetWeightKg").value(62.5))
            .andExpect(jsonPath("$.overloadSummary.weightUp").value(1));
    }
}
```

> Uses the `ApiIntegrationTest` verb helper `getAuth(...)` (which applies `ownerAuthHeaders()`), per `integration_test_framework.md`. `trainData.activeMesoWithBenchHistory(...)` seeds an active meso (non-deload current week) + one completed bench instance; add it to the Train populator if absent.

- [ ] **Step 2: Run IT to verify it fails**

Run: `cd backend && ./mvnw -q clean test -Dtest=ProgressionSignalIT`
Expected: FAIL — `progression`/`overloadSummary` absent from the response.

- [ ] **Step 3: Wire `getToday`**

In `WorkoutService.getToday` (`WorkoutService.java`), immediately **before** the `return WorkoutTodayResponse.builder()` (currently line ~151), compute the deload flag:

```java
        boolean deloadWeek = activeMeso != null
            && activeMeso.getPhaseCurve() != null
            && activeMeso.getCurrentWeek() < activeMeso.getPhaseCurve().size()
            && "Deload".equalsIgnoreCase(activeMeso.getPhaseCurve().get(activeMeso.getCurrentWeek()));
        int weightUp = 0;
        int repUp = 0;
        int hold = 0;
```

Change the exercise-mapping lambda (`WorkoutService.java:162-166`) to attach the signal and tally the summary. Because a lambda can't mutate locals, tally via an array or move to an explicit loop. Replace the `.exercises(...)` builder arg with a pre-built list:

```java
        List<TodayExercise> mapped = new ArrayList<>();
        for (ExerciseEntity e : exercises) {
            TodayExercise t = mapper.toTodayExercise(e);
            t.setLastWeek(lastWeek.get(e.getId()));
            if (e.getCatalogId() != null) {
                t.setVideoUrl(videoByCatalog.get(e.getCatalogId()));
            }
            if (hypertrophyGate.getIfAvailable() != null) {
                Prescription p = setRecommendationService.prescribe(createdBy, e, deloadWeek);
                t.setPrescribedSets(p.sets());
                t.setRationale(p.rationale());
                t.setProgression(p.progression());
                if (p.progression() != null) {
                    switch (p.progression().getLever()) {
                        case WEIGHT -> weightUp++;
                        case REP -> repUp++;
                        default -> hold++; // HOLD, DELOAD
                    }
                }
            }
            mapped.add(t);
        }
        OverloadSummary overloadSummary = hypertrophyGate.getIfAvailable() != null
            ? OverloadSummary.builder().weightUp(weightUp).repUp(repUp).hold(hold).build()
            : null;
```

Then in the builder replace `.exercises(exercises.stream()....toList())` with `.exercises(mapped)` and add `.overloadSummary(overloadSummary)` before `.build()`. Add imports `import io.mrkuhne.mezo.api.dto.OverloadSummary;` and `import io.mrkuhne.mezo.api.dto.TodayExercise;` if not present.

> A WEIGHT lever with a negative `deltaKg` (grind back-off) still counts as `weightUp` in the summary — acceptable for v1 (the chip reads "n× +súly"); refine only if it reads wrong in review (spec §11 is silent on this — default to counting all WEIGHT movements together).

- [ ] **Step 4: Run IT to verify it passes**

Run: `cd backend && ./mvnw -q clean test -Dtest=ProgressionSignalIT`
Expected: PASS.

- [ ] **Step 5: Run the focused Train suite for regressions**

Run: `cd backend && ./mvnw -q clean test -Dtest='*Workout*IT,SetRecommendationServiceIT,ProgressionDeciderTest'`
Expected: PASS (existing `prescribe` callers now pass `deloadWeek` — confirm none were missed; the only production caller is `getToday`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/
git commit -m "feat(train): getToday attaches progression + overloadSummary (mezo-5pfe)"
```

---

### Task 5: Frontend domain types + mapping + mock fixture

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/train/trainHooks.ts`
- Modify: `frontend/src/data/train/train.ts`

**Interfaces:**
- Produces: domain `ProgressionSignal` `{ lever: 'weight'|'rep'|'hold'|'deload'; deltaKg: number | null; deltaReps: number | null; targetWeightKg: number | null; targetReps: number; rationale: string }`; domain `OverloadSummary` `{ weightUp: number; repUp: number; hold: number }`; `LoggedWorkoutExercise.progression?: ProgressionSignal | null`; `WorkoutPlan.overloadSummary?: OverloadSummary | null`.

- [ ] **Step 1: Add domain types** — in `frontend/src/data/types.ts`, right above `export interface LoggedWorkoutExercise` (line ~764):

```ts
export interface ProgressionSignal {
  lever: 'weight' | 'rep' | 'hold' | 'deload'
  deltaKg: number | null
  deltaReps: number | null
  targetWeightKg: number | null
  targetReps: number
  rationale: string
}
export interface OverloadSummary { weightUp: number; repUp: number; hold: number }
```

Add to `LoggedWorkoutExercise` (after `rationale`): `progression?: ProgressionSignal | null`. Add to `WorkoutPlan` (after `challenges`): `overloadSummary?: OverloadSummary | null`.

- [ ] **Step 2: Map in `toWorkoutPlan`** — `frontend/src/data/train/trainHooks.ts`. Inside the `exercises.map((e) => ({ … }))` add after the `lastWeek` field (line ~78):

```ts
      progression: e.progression
        ? {
            lever: e.progression.lever,
            deltaKg: e.progression.deltaKg ?? null,
            deltaReps: e.progression.deltaReps ?? null,
            targetWeightKg: e.progression.targetWeightKg ?? null,
            targetReps: e.progression.targetReps,
            rationale: e.progression.rationale,
          }
        : null,
```

and after the `challenges: []` line in the returned object add:

```ts
    overloadSummary: r.overloadSummary
      ? { weightUp: r.overloadSummary.weightUp, repUp: r.overloadSummary.repUp, hold: r.overloadSummary.hold }
      : null,
```

- [ ] **Step 3: Add demo data to the mock fixture** — in `frontend/src/data/train/train.ts`, on the `trainWorkout` fixture: give its first exercise a `progression` and the plan an `overloadSummary` so mock mode shows the banner:

```ts
  // on the first exercise object:
  progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 62.5, targetReps: 6,
    rationale: 'Múlt hét 60×8 kg a tartomány tetején → +2,5 kg' },
  // …and on a second exercise, a rep example:
  progression: { lever: 'rep', deltaKg: null, deltaReps: 1, targetWeightKg: 24, targetReps: 9,
    rationale: 'Múlt hét könnyen ment (RIR 3) → +1 rep' },
  // on the trainWorkout plan object:
  overloadSummary: { weightUp: 3, repUp: 1, hold: 0 },
```

- [ ] **Step 4: Typecheck both modes**

Run: `cd frontend && pnpm build`
Expected: PASS (tsc clean — the new fields are optional so no other fixture breaks).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/
git commit -m "feat(train): progression + overloadSummary on the FE data boundary (mezo-5pfe)"
```

---

### Task 6: `ProgressionBanner` component

**Files:**
- Create: `frontend/src/features/train/components/ProgressionBanner.tsx`
- Test: `frontend/src/features/train/components/ProgressionBanner.test.tsx`

**Interfaces:**
- Consumes: `ProgressionSignal`, `LastWeekSet` (`@/data/types`, Task 5).
- Produces: `<ProgressionBanner progression={ProgressionSignal} lastWeek={LastWeekSet | null} />`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressionBanner } from '@/features/train/components/ProgressionBanner'

describe('ProgressionBanner', () => {
  const last = { weight: 60, reps: 8, rir: 2 }

  it('shows a weight-up delta and the last→now comparison', () => {
    render(<ProgressionBanner lastWeek={last} progression={{
      lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 62.5, targetReps: 6,
      rationale: 'Múlt hét 60×8 kg a tartomány tetején → +2,5 kg',
    }} />)
    expect(screen.getByText(/\+2[.,]5 kg/)).toBeInTheDocument()
    expect(screen.getByText(/Múlt hét/)).toBeInTheDocument()
    expect(screen.getByText(/Ma a cél/)).toBeInTheDocument()
  })

  it('shows a rep-up delta', () => {
    render(<ProgressionBanner lastWeek={{ weight: 62.5, reps: 8, rir: 3 }} progression={{
      lever: 'rep', deltaKg: null, deltaReps: 1, targetWeightKg: 62.5, targetReps: 9,
      rationale: 'Múlt hét könnyen ment (RIR 3) → +1 rep',
    }} />)
    expect(screen.getByText(/\+1 rep/)).toBeInTheDocument()
  })

  it('shows a back-off state on deload', () => {
    render(<ProgressionBanner lastWeek={{ weight: 62.5, reps: 6, rir: 0 }} progression={{
      lever: 'deload', deltaKg: -8, deltaReps: null, targetWeightKg: 54, targetReps: 6,
      rationale: 'Deload hét — visszaveszünk',
    }} />)
    expect(screen.getByText(/Deload hét/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && pnpm test src/features/train/components/ProgressionBanner.test.tsx`
Expected: FAIL — cannot find module `ProgressionBanner`.

- [ ] **Step 3: Write the component**

```tsx
// ============================================================
// Mezo · ProgressionBanner (mezo-5pfe) — the in-workout progressive-overload
// signal: label + delta chip, a "Múlt hét → Ma a cél" two-cell comparison, and
// the engine rationale. Three visual states by lever: weight=coral, rep=sage,
// hold/deload=amber back-off. Presentational only; replaces the .aistrip strip.
// ============================================================
import type { LastWeekSet, ProgressionSignal } from '@/data/types'

const fmt = (n: number) => n.toLocaleString('hu-HU')

function deltaLabel(p: ProgressionSignal): string {
  if (p.deltaKg != null && p.deltaKg !== 0) return `${p.deltaKg > 0 ? '+' : '−'}${fmt(Math.abs(p.deltaKg))} kg ${p.deltaKg > 0 ? '↑' : '↓'}`
  if (p.deltaReps != null) return `+${p.deltaReps} rep ↑`
  return 'tartás'
}

export function ProgressionBanner({ progression, lastWeek }: {
  progression: ProgressionSignal
  lastWeek: LastWeekSet | null
}) {
  const p = progression
  const tone = p.lever === 'weight' ? 'po-weight' : p.lever === 'rep' ? 'po-rep' : 'po-hold'
  const now = p.targetWeightKg != null ? `${fmt(p.targetWeightKg)} × ${p.targetReps}` : `× ${p.targetReps}`
  return (
    <div className={`pobanner ${tone}`}>
      <div className="pobanner-lab">
        <span className="txt">⚡ Progresszió</span>
        <span className="delta">{deltaLabel(p)}</span>
      </div>
      <div className="pobanner-cells">
        <div className="cell">
          <div className="clab">Múlt hét</div>
          <div className="cval">{lastWeek ? `${fmt(lastWeek.weight)} × ${lastWeek.reps} · RIR ${lastWeek.rir}` : '—'}</div>
        </div>
        <div className="cell now">
          <div className="clab">Ma a cél</div>
          <div className="cval up">{now}</div>
        </div>
      </div>
      <p className="pobanner-why">{p.rationale}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && pnpm test src/features/train/components/ProgressionBanner.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/train/components/ProgressionBanner.tsx \
        frontend/src/features/train/components/ProgressionBanner.test.tsx
git commit -m "feat(train): ProgressionBanner component (mezo-5pfe)"
```

---

### Task 7: Render the banner in the active workout + CSS

**Files:**
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx`
- Modify: `frontend/src/index.css` (or the file that owns `.aistrip` — confirm with `grep -rl '\.aistrip' frontend/src`)

**Interfaces:**
- Consumes: `ProgressionBanner` (Task 6); `current.progression`, `current.lastWeek` (Task 5).

- [ ] **Step 1: Add the CSS family** — append to the stylesheet that defines `.aistrip`:

```css
.pobanner { border:1px solid var(--coral-deep); border-radius:12px; padding:11px 12px; margin:8px 24px; background:color-mix(in srgb, var(--coral) 8%, var(--surface-1)); }
.pobanner.po-hold { border-color:var(--amber-deep); background:color-mix(in srgb, var(--amber) 8%, var(--surface-1)); }
.pobanner-lab { display:flex; align-items:center; gap:8px; margin-bottom:9px; }
.pobanner-lab .txt { font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--coral-deep); font-weight:700; white-space:nowrap; }
.pobanner.po-rep .pobanner-lab .txt { color:var(--sage-deep); }
.pobanner.po-hold .pobanner-lab .txt { color:var(--amber-deep); }
.pobanner-lab .delta { margin-left:auto; background:var(--coral); color:var(--surface-1); padding:3px 9px; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
.pobanner.po-rep .pobanner-lab .delta { background:var(--sage); }
.pobanner.po-hold .pobanner-lab .delta { background:transparent; border:1px solid var(--amber-deep); color:var(--amber-deep); }
.pobanner-cells { display:flex; align-items:stretch; }
.pobanner-cells .cell { flex:1; min-width:0; }
.pobanner-cells .cell.now { padding-left:12px; border-left:1px solid var(--coral-deep); margin-left:12px; }
.pobanner-cells .clab { font-size:9px; letter-spacing:.05em; text-transform:uppercase; color:var(--text-tertiary); }
.pobanner-cells .cval { font-size:15px; font-weight:650; margin-top:3px; white-space:nowrap; }
.pobanner-cells .cell.now .cval { font-size:19px; }
.pobanner-cells .cell.now .cval.up { color:var(--coral-deep); }
.pobanner.po-rep .cell.now .cval.up { color:var(--sage-deep); }
.pobanner-why { font-size:11px; color:var(--text-secondary); margin-top:8px; }
```

> Confirm the token names (`--sage-deep`, `--amber-deep`, `--surface-1`) exist; if a `-deep` variant is missing, use the base token (`--sage`/`--amber`). Grep `frontend/src` for the palette before finalizing.

- [ ] **Step 2: Import + render** — in `ActiveWorkoutPage.tsx` add `import { ProgressionBanner } from '@/features/train/components/ProgressionBanner'` and replace the `.aistrip` block (lines ~1055-1063) with:

```tsx
        {/* Progressive-overload signal (mezo-5pfe): the structured banner when the engine
            emits a progression, else the plain rationale strip (first session / anchor). */}
        {current.progression ? (
          <ProgressionBanner progression={current.progression} lastWeek={current.lastWeek} />
        ) : current.rationale ? (
          <div className="aistrip">
            <span aria-hidden="true">✨</span>
            <p>{current.rationale}</p>
          </div>
        ) : null}
```

- [ ] **Step 3: Verify build + focused test**

Run: `cd frontend && pnpm build && pnpm test src/features/train/pages/ActiveWorkoutPage.test.tsx`
Expected: PASS (existing active-workout tests still green; the rationale strip still renders when `progression` is null).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/train/pages/ActiveWorkoutPage.tsx frontend/src/index.css
git commit -m "feat(train): render ProgressionBanner in active workout (mezo-5pfe)"
```

---

### Task 8: Prep card delta chip + PrepHero overload summary

**Files:**
- Modify: `frontend/src/features/train/components/PrepExerciseCard.tsx`
- Modify: `frontend/src/features/train/components/PrepHero.tsx`
- Modify: `frontend/src/features/train/pages/ActiveWorkoutPage.tsx` (pass `overload` prop to `PrepHero`)
- Test: extend `frontend/src/features/train/components/PrepExerciseCard.test.tsx`

**Interfaces:**
- Consumes: `exercise.progression` (Task 5) on `PrepExerciseCard`; a new `overload?: OverloadSummary | null` prop on `PrepHero` fed from `W.overloadSummary`.

- [ ] **Step 1: Write the failing prep-card test** — add to `PrepExerciseCard.test.tsx`:

```tsx
it('renders an overload delta chip from the progression signal', () => {
  render(<PrepExerciseCard oneRmKg={null} accentChallenge={null} exercise={{
    ...baseExercise, // the file's existing fixture
    progression: { lever: 'weight', deltaKg: 2.5, deltaReps: null, targetWeightKg: 62.5, targetReps: 6, rationale: '' },
  }} />)
  expect(screen.getByText(/\+2[.,]5 kg/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm test src/features/train/components/PrepExerciseCard.test.tsx`
Expected: FAIL — no `+2,5 kg` chip.

- [ ] **Step 3: Add the delta chip to `PrepExerciseCard`** — in the pill row (after the start-weight pill, `PrepExerciseCard.tsx:74-76`):

```tsx
          {e.progression && (e.progression.deltaKg || e.progression.deltaReps) != null && (
            <span
              className="chip"
              style={{
                fontSize: 9, padding: '3px 8px', fontWeight: 700,
                background: e.progression.lever === 'rep' ? 'var(--sage)' : 'var(--coral)',
                color: 'var(--surface-1)', border: 'none',
              }}
            >
              {e.progression.deltaKg != null && e.progression.deltaKg !== 0
                ? `${e.progression.deltaKg > 0 ? '+' : '−'}${Math.abs(e.progression.deltaKg).toLocaleString('hu-HU')} kg`
                : `+${e.progression.deltaReps} rep`}
            </span>
          )}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd frontend && pnpm test src/features/train/components/PrepExerciseCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Add the PrepHero overload chip** — add `overload?: OverloadSummary | null` to the `PrepHero` props (import `OverloadSummary` from `@/data/types`), and render it right below the stats pill (`PrepHero.tsx:96-106`), inside the same card:

```tsx
      {overload && (overload.weightUp + overload.repUp) > 0 && (
        <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
          <span className="chip" style={{ fontSize: 10.5, background: 'color-mix(in srgb, var(--coral) 10%, transparent)', color: 'var(--coral-deep)', borderColor: 'var(--coral-deep)' }}>
            ⚡ Túlterhelés: {[
              overload.weightUp > 0 ? `${overload.weightUp}× +súly` : null,
              overload.repUp > 0 ? `${overload.repUp}× +rep` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        </div>
      )}
```

- [ ] **Step 6: Pass the prop from the prep composition** — in `ActiveWorkoutPage.tsx` where `<PrepHero … />` is rendered, add `overload={W.overloadSummary ?? null}` to its props. (Grep `grep -n 'PrepHero' frontend/src/features/train/pages/ActiveWorkoutPage.tsx` to locate the call site.)

- [ ] **Step 7: Full both-modes gate**

Run: `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test`
Expected: PASS in both modes.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/train/
git commit -m "feat(train): prep delta chip + PrepHero overload summary (mezo-5pfe)"
```

---

## Self-Review

**Spec coverage (Pillar 1 + §8 surfacing):**
- §5.1 RIR matrix → Task 2 (decider) + Task 3 (wiring). ✅ (all 6 matrix rows + weightless + first-session + deload covered)
- Phase-aware deload regression → Task 2 deload branch + Task 4 `deloadWeek` from `phaseCurve[currentWeek]`. ✅
- `ProgressionSignal` + `overloadSummary` contract → Task 1. ✅
- Set-card banner (D8, B2+C, 3 states) → Task 6 + Task 7. ✅
- Prep delta chip (D9, treatment A) + PrepHero day-summary → Task 8. ✅
- Feature switch reuse (D12 intensity half) → Tasks 3/4 gate on `hypertrophyGate`. ✅
- Mock parity (D13) → Task 5 fixtures + optional fields. ✅
- **Deferred to Plan 2/3 (correctly absent here):** VolumeProgressionService, week rollover, effective set distribution, volume-arc endpoint, MesoOverviewPage, Mai/Gym entry chips, challenge tie-in.

**Placeholder scan:** No TBD/TODO; every code step carries real code. Two honestly-flagged confirmations (palette `-deep` token names in Task 7 Step 1; WEIGHT-negative counting in Task 4 Step 3) — both have a concrete default, so they are not blockers.

**Type consistency:** `ProgressionSignal` fields identical across contract (Task 1), backend build (Task 3), FE domain type + mapping (Task 5), component (Task 6), prep (Task 8). `Lever` values `weight|rep|hold|deload` consistent everywhere. `prescribe(createdBy, ex, deloadWeek)` 3-arg signature used only in Task 4 (sole production caller). `Prescription` 3-field record used only in Tasks 3/4.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-progressive-overload-p1-intensity-signal.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
