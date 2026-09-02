# Diet Plan Slice 3 — Training-day vs Rest-day kcal Shifting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner can shift kcal from rest days onto training days (weekly budget unchanged, delta lands in carbs), prescribed by the goal engine per segment and served consistently by both the backend fuel-day targets and the frontend day budget.

**Architecture:** `diet_settings` gains a `dayTypeShiftKcal` knob → the goal engine computes per-segment `trainingDayKcal`/`restDayKcal` (pure math, BMR-floored, weekly-sum-invariant) → `FuelDayService` picks the day's number by classifying the date via `WorkoutWindowQueryService`, deriving the carb delta at serve time → the FE `deriveDailyBudget` applies the same day-type delta on top of its actual-MET model (no double counting: the delta is a budget *reallocation*, actual EAT is *expenditure*).

**Tech Stack:** Spring Boot + Liquibase + jsonb prescription (backend), OpenAPI contract-first codegen, React/TypeScript + vitest (frontend).

**Spec:** `docs/superpowers/specs/2026-09-02-diet-plan-design.md` (§6.4)

**Depends on:** Slice 1 (Diet split foundations) MUST be merged first: `DietSettingsEntity`/`DietSettingsService`/`DietSettingsProperties` in `feature/nutrition`, a diet-preferences read consumed by the goal engine, `Segment.carbsG`/`fatG`, and the "Diéta" section in `FuelSettingsSheet`. Slice 2 (schedule-edit recompute triggers) is strongly recommended first — without it, editing the gym/sport schedule leaves stale day-type numbers until the next weigh-in.

## Global Constraints

- Contract-drift CI gate: any `api/feature/**/*.yml` edit regenerates BOTH clients in the same commit — backend: `cd api/generate && npm run generate:api`; frontend: `cd frontend && pnpm generate:api`.
- CODEMAP freshness gate: new files/classes → `node scripts/gen-codemap.mjs` before commit (`--check` is what CI runs).
- Frozen ArchUnit store: `git status` before every commit — a green backend run can silently EMPTY `backend/archunit_store/`; never commit a deleted/emptied store file.
- Dual FE test modes: `cd frontend && pnpm test` AND `cd frontend && VITE_USE_MOCK=true pnpm test` must both pass (the gitignored `frontend/.env` makes the bare run real-mode).
- Full backend suite must NOT run locally (16 GB OOM). Focused classes only, foreground:
  `cd backend && ./mvnw clean test -Dtest='<Classes>' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"`. CI is the authoritative full gate.
- Conventional commits carrying the driving bd id: `feat(goal): … (mezo-XXXX)` — replace `mezo-XXXX` with the slice's real bd issue id at execution time.
- Code/comments/commit messages in ENGLISH; user-facing UI copy in HUNGARIAN.
- Liquibase: raw SQL script in `backend/src/main/resources/db/changelog/1.0.0/script/` + a changeSet entry appended to `1.0.0/1.0.0_master.yml` (id `"1.0.0:<filename-without-ext>"`, author `daniel.kuhne`).
- New engine numbers are config- or settings-driven — never hardcoded constants (`GoalEngineProperties` idiom).

## The math (single source of truth for every task below)

Per prescription segment, with `S = dayTypeShiftKcal` (user setting, kcal), `kcal` = the segment's uniform daily target, `T` = training days/week, `R = 7 − T` rest days/week, `bmr` = `tdeeBootstrap.bmr`:

```
restDayKcal      = max(kcal − S, ceil(bmr))          // BMR floor — shared with the FE's existing floor semantics
effectiveShift   = kcal − restDayKcal                 // ≤ S when the floor bit
trainingDayKcal  = kcal + round(effectiveShift × R / T)
```

Emit `null` for both fields (uniform day) when: `S ≤ 0`, `T == 0` (no training at all), `T == 7` (no rest day to take from), or `effectiveShift ≤ 0`.

**Weekly-sum invariance:** `T×trainingDayKcal + R×restDayKcal = 7×kcal ± T/2` (only the one `round()` drifts; exact when `effectiveShift × R` divides by `T`).

Worked example A (mock fixture numbers, no floor): `kcal=2150, S=200, T=4, R=3` → rest `1950`, training `2150 + round(200×3/4) = 2300`. Weekly: `4×2300 + 3×1950 = 15050 = 7×2150` ✓.

Worked example B (floor bites): `kcal=1800, bmr=1720, S=200, T=4, R=3` → rest `max(1600, 1720) = 1720`, effective `80`, training `1800 + round(80×3/4) = 1860`. Weekly: `4×1860 + 3×1720 = 12600 = 7×1800` ✓.

**Carbs: derived at serve/display time, NOT stored.** The segment keeps its uniform `carbsG` (slice 1); a day's carbs = `carbsG + (dayKcal − kcal) / 4`. Justification: protein and fat are constant across day types (ISSN — the delta is carbs by definition), so storing per-day-type carb fields would be two redundant jsonb+contract fields derivable from one kcal delta; deriving at the two serve points (BE `targetSet`, FE `deriveDailyBudget`) keeps the prescription minimal and cannot drift from the kcal numbers.

**FE composition rule (no double counting).** The FE dynamic budget is `max(bmr, maintenance + eat + balance)` where `eat` is TODAY's actual MET expenditure — already day-varying. The shift is a *preference reallocation* on top, NOT an expenditure estimate, so it composes additively as a delta read off the segment:

```
dayTypeDelta = isTrainingDay ? (trainingDayKcal − kcal) : (restDayKcal − kcal)   // 0 when fields are null
target       = max(bmr, maintenance + eat + balance + dayTypeDelta)
```

Weekly sum of deltas is 0 (that's the invariance above), so the weekly FE budget is unchanged — no double counting: `eat` answers "what did I burn", `dayTypeDelta` answers "where do I prefer my calories". Worked (mock numbers, `bmr 1720, neat 1.2 → maintenance 2064, balance −516, S=200, T=4, R=3`):
- Training day with a 60′ gym block at 78.6 kg: `eat = 6.0×78.6×1 = 472`; `delta = 2300−2150 = +150` → `target = 2064+472−516+150 = 2170`.
- Rest day: `eat = 0`; `delta = 1950−2150 = −200` → `2064+0−516−200 = 1348` → floored to `bmr = 1720`.

**BE/FE day classification must agree.** FE: `resolveDayType(blocks) === 'rest'` ⇔ `deriveBlocks(...)` returned no blocks (gym slot today + sport slots/one-off events today + prescribed run today). BE: `WorkoutWindowQueryService.windowsFor(userId, date)` non-empty ⇔ training day — the same source set (weekday-matched gym slots, sport slots + dated one-off events + logged sessions, prescribed runs). `feature/meal → train.WorkoutWindowQueryService` is an established dependency (`MealService.java:74`).

**Deliberately untouched:** `Segment.restDays` stays `List.of()` (its existing fixtures use a different day convention; populating it is display work outside this slice).

---

### Task 1: Contract extension — segment day-type kcal + settings field

**Files:**
- Modify: `api/feature/goal/goal.yml` (GoalPrescriptionSegment schema, ~line 180)
- Modify: `api/feature/diet-settings/diet-settings.yml` (created by slice 1 — response + request schemas)
- Regenerate: backend `api` DTOs + `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: slice 1's `diet-settings.yml` fragment (GET/PUT `/api/diet/settings`, `DietSettingsResponse`/`SetDietSettingsRequest`).
- Produces: `GoalPrescriptionSegment.trainingDayKcal`/`restDayKcal` (integer, nullable, NOT in `required`) and `dayTypeShiftKcal` (integer, required, 0–500) on both diet-settings schemas — the wire names every later task uses.

- [ ] **Step 1: Extend GoalPrescriptionSegment in goal.yml**

In `api/feature/goal/goal.yml`, add to `GoalPrescriptionSegment.properties` (do NOT add to `required` — additive, nullable):

```yaml
        trainingDayKcal: { type: integer, nullable: true, description: 'Day-type kcal target on a training day (kcal + shift×restDays/trainingDays); null → uniform kcal (mezo-XXXX)' }
        restDayKcal: { type: integer, nullable: true, description: 'Day-type kcal target on a rest day (kcal − shift, floored at BMR); null → uniform kcal (mezo-XXXX)' }
```

- [ ] **Step 2: Extend diet-settings.yml**

In slice 1's `api/feature/diet-settings/diet-settings.yml`, add to BOTH `DietSettingsResponse.properties` and `SetDietSettingsRequest.properties`, and to both `required` lists:

```yaml
        dayTypeShiftKcal:
          type: integer
          minimum: 0
          maximum: 500
          description: 'Kcal moved off each rest day onto training days (weekly budget unchanged); 0 = uniform days'
```

- [ ] **Step 3: Regenerate both clients**

Run: `cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api`
Expected: backend generated DTO `GoalPrescriptionSegment` gains `trainingDayKcal`/`restDayKcal`, `DietSettingsResponse`/`SetDietSettingsRequest` gain `dayTypeShiftKcal`; `frontend/src/data/_client/api.gen.ts` shows the same fields (`git diff --stat` touches both generated trees).

- [ ] **Step 4: Compile check**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS (fields are additive; nothing consumes them yet). Frontend: `cd frontend && pnpm exec tsc -b --noEmit` (or `pnpm build` if that's faster locally) — no errors.

- [ ] **Step 5: Commit**

```bash
git add api/ backend/src/gen frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): day-type kcal on prescription segment + dayTypeShiftKcal diet setting (mezo-XXXX)"
```
(If generated backend sources live under a different path, `git status` after Step 3 shows the real one — stage whatever the regen touched.)

---

### Task 2: `diet_settings.day_type_shift_kcal` — migration, entity, ghost, service

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609021200_mezo-XXXX_diet_settings_day_type_shift.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (append changeSet)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/entity/DietSettingsEntity.java` (slice 1)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/DietSettingsProperties.java` (slice 1)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DietSettingsService.java` (slice 1)
- Modify: `backend/src/main/resources/application.yml` (`mezo.diet-settings.*` ghost block from slice 1)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietSettingsDayTypeShiftIT.java` (new class — independent of slice 1's test names)

**Interfaces:**
- Consumes: slice 1's `DietSettingsEntity` (per-user singleton, `fuel_settings` idiom: `@SQLDelete`/`@SQLRestriction`, `findByCreatedByAndDeletedFalse`), `DietSettingsService.getSettings(UUID)`/`setSettings(UUID, SetDietSettingsRequest)` with config ghost, save-triggers-evaluate.
- Produces: `DietSettingsEntity.getDayTypeShiftKcal(): Integer` (never null after read — ghost default 0); the persisted+ghosted value the engine reads in Task 5.

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.nutrition;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.DietSettingsResponse;
import io.mrkuhne.mezo.api.dto.SetDietSettingsRequest;
import io.mrkuhne.mezo.feature.nutrition.service.DietSettingsService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice 3: the day-type shift knob rides the diet-settings singleton (ghost 0, persisted round-trip). */
@Transactional
class DietSettingsDayTypeShiftIT extends AbstractIntegrationTest {

    @Autowired private DietSettingsService service;

    @Test
    void ghostServesZeroShiftBeforeFirstSave() {
        DietSettingsResponse ghost = service.getSettings(UUID.randomUUID());
        assertThat(ghost.getDayTypeShiftKcal()).isZero();
    }

    @Test
    void shiftRoundTripsThroughSave() {
        UUID owner = UUID.randomUUID();
        SetDietSettingsRequest req = buildSaveRequestWithDefaults(); // see Step 1 note below
        req.setDayTypeShiftKcal(200);
        service.setSettings(owner, req);
        assertThat(service.getSettings(owner).getDayTypeShiftKcal()).isEqualTo(200);
    }
}
```

Note: `buildSaveRequestWithDefaults()` is a private helper you write in this test class filling slice 1's required fields (splitPreset etc.) with their ghost values — copy the field list from slice 1's `SetDietSettingsRequest`; the shift assertions are what this class is about.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='DietSettingsDayTypeShiftIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"`
Expected: COMPILE ERROR — `getDayTypeShiftKcal()` does not exist yet (the contract DTO has it from Task 1, but the entity/service don't map it, so the ghost test fails on the unmapped/zero-vs-null value once it compiles).

- [ ] **Step 3: Migration**

`202609021200_mezo-XXXX_diet_settings_day_type_shift.sql`:

```sql
-- Diet Plan slice 3 (bd mezo-XXXX, spec docs/superpowers/specs/2026-09-02-diet-plan-design.md §6.4).
-- Kcal moved off each rest day onto training days; 0 = uniform. The engine reads it per evaluate.
alter table diet_settings
    add column day_type_shift_kcal integer not null default 0;
```

Append to `1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609021200_mezo-XXXX_diet_settings_day_type_shift"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609021200_mezo-XXXX_diet_settings_day_type_shift.sql
```

- [ ] **Step 4: Entity + ghost + service mapping**

`DietSettingsEntity` gains (mirroring the `FuelSettingsEntity` bean-validation idiom):

```java
    @NotNull
    @Min(0)
    @Max(500)
    @Column(name = "day_type_shift_kcal", nullable = false)
    private Integer dayTypeShiftKcal;
```

`DietSettingsProperties` gains a ghost component (follow slice 1's record shape):

```java
    /** Day-type kcal shift ghost — 0 = uniform days until the user opts in. */
    @Min(0) @Max(500)
    int defaultDayTypeShiftKcal,
```

`application.yml` under the slice-1 `mezo.diet-settings:` block: `default-day-type-shift-kcal: 0`.

`DietSettingsService`: thread the field through `getSettings` (entity value / ghost `properties.defaultDayTypeShiftKcal()`), `setSettings` (`row.setDayTypeShiftKcal(req.getDayTypeShiftKcal())`), and the private `compose(...)` builder. The save path already calls `recomputeActiveGoal`-style evaluate (slice 1) — no new trigger needed; verify the call is still there and note it in the commit body if slice 1 named it differently.

- [ ] **Step 5: Run the IT to verify it passes**

Run: same command as Step 2.
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/nutrition backend/src/main/resources/application.yml backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/DietSettingsDayTypeShiftIT.java
git commit -m "feat(nutrition): dayTypeShiftKcal setting — migration, ghost 0, round-trip (mezo-XXXX)"
```

---

### Task 3: Scheduled training-day-of-weeks primitive on the train side

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityTrainingDaysIT.java` (new)

**Interfaces:**
- Consumes: existing `gymRepo`/`sportRepo` finders already injected in the service.
- Produces: `public Set<Integer> scheduledTrainingDayOfWeeks(UUID userId)` — distinct `dayOfWeek` values (0=Mon..6=Sun, the slot-table convention) of the owner's recurring gym + sport slots. Running days are NOT included here (they are per-segment; the projection adds them itself in Task 5).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Slice 3: the distinct scheduled training weekdays (gym ∪ sport) that size the day-type split. */
@Transactional
class WeeklyScheduledActivityTrainingDaysIT extends AbstractIntegrationTest {

    @Autowired private WeeklyScheduledActivityService service;
    @Autowired private GymScheduleSlotRepository gymRepo;
    @Autowired private SportScheduleSlotRepository sportRepo;

    @Test
    void unionsGymAndSportWeekdaysDistinct() {
        UUID owner = UUID.randomUUID();
        gymSlot(owner, 0, "17:30");           // Mon
        gymSlot(owner, 3, "17:30");           // Thu
        sportSlot(owner, 3, "19:00", 90);     // Thu again — must not double-count
        sportSlot(owner, 5, "10:00", 120);    // Sat

        assertThat(service.scheduledTrainingDayOfWeeks(owner)).containsExactlyInAnyOrder(0, 3, 5);
    }

    @Test
    void emptyScheduleYieldsEmptySet() {
        assertThat(service.scheduledTrainingDayOfWeeks(UUID.randomUUID())).isEmpty();
    }

    private void gymSlot(UUID owner, int dow, String time) {
        GymScheduleSlotEntity g = new GymScheduleSlotEntity();
        g.setCreatedBy(owner);
        g.setDayOfWeek(dow);
        g.setTime(time);
        gymRepo.save(g);
    }

    private void sportSlot(UUID owner, int dow, String time, int durationMin) {
        SportScheduleSlotEntity s = new SportScheduleSlotEntity();
        s.setCreatedBy(owner);
        s.setDayOfWeek(dow);
        s.setTime(time);
        s.setDurationMin(durationMin);
        s.setKind("training");
        s.setSport("volleyball");
        sportRepo.save(s);
    }
}
```

(If `SportScheduleSlotEntity`/`GymScheduleSlotEntity` have further `@NotNull` columns the compiler/DB flags, set them to the values `TrainPopulator` uses — read that populator rather than inventing values.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='WeeklyScheduledActivityTrainingDaysIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"`
Expected: COMPILE ERROR — `scheduledTrainingDayOfWeeks` undefined.

- [ ] **Step 3: Implement**

Add to `WeeklyScheduledActivityService` (below `scheduledWeeklyEatKcalPerDay`):

```java
    /** Distinct scheduled training weekdays (0=Mon..6=Sun): gym ∪ sport recurring slots. Running is
     *  goal-linked/per-segment, so the projection unions its days itself (slice 3 day-type split). */
    @Transactional(readOnly = true)
    public Set<Integer> scheduledTrainingDayOfWeeks(UUID userId) {
        Set<Integer> days = new TreeSet<>();
        gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)
            .forEach(g -> days.add(g.getDayOfWeek()));
        sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId)
            .forEach(s -> days.add(s.getDayOfWeek()));
        return days;
    }
```

(Imports: `java.util.Set`, `java.util.TreeSet`.)

- [ ] **Step 4: Run to verify it passes**

Same command. Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityService.java backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WeeklyScheduledActivityTrainingDaysIT.java
git commit -m "feat(train): scheduledTrainingDayOfWeeks — the day-type split's weekday basis (mezo-XXXX)"
```

---

### Task 4: Pure day-type split math

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/DayTypeShiftCalculator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/DayTypeShiftCalculatorTest.java` (plain JUnit, no Spring)

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `DayTypeShiftCalculator.split(int segmentKcal, int shiftKcal, int trainingDays, BigDecimal bmr)` returning `DayTypeKcal(Integer trainingDayKcal, Integer restDayKcal)` — both null ⇔ uniform day. Task 5 calls this.

- [ ] **Step 1: Write the failing test**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.DayTypeShiftCalculator.DayTypeKcal;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** The slice-3 split math: weekly-sum invariance, BMR floor, uniform-day edge cases. Pure JUnit. */
class DayTypeShiftCalculatorTest {

    private static final BigDecimal BMR = new BigDecimal("1720.00");

    @Test
    void splitsShiftWeeklySumInvariant() { // worked example A from the plan header
        DayTypeKcal r = DayTypeShiftCalculator.split(2150, 200, 4, BMR);
        assertThat(r.restDayKcal()).isEqualTo(1950);
        assertThat(r.trainingDayKcal()).isEqualTo(2300);
        assertThat(4 * r.trainingDayKcal() + 3 * r.restDayKcal()).isEqualTo(7 * 2150);
    }

    @Test
    void bmrFloorShrinksTheEffectiveShift() { // worked example B
        DayTypeKcal r = DayTypeShiftCalculator.split(1800, 200, 4, BMR);
        assertThat(r.restDayKcal()).isEqualTo(1720);
        assertThat(r.trainingDayKcal()).isEqualTo(1860);
        assertThat(4 * r.trainingDayKcal() + 3 * r.restDayKcal()).isEqualTo(7 * 1800);
    }

    @Test
    void weeklySumStaysWithinRoundingBoundAcrossTheGrid() {
        for (int t = 1; t <= 6; t++) {
            for (int s = 50; s <= 500; s += 50) {
                for (int kcal = 1800; kcal <= 3200; kcal += 175) {
                    DayTypeKcal r = DayTypeShiftCalculator.split(kcal, s, t, BMR);
                    if (r.trainingDayKcal() == null) continue; // floor swallowed the whole shift
                    int weekly = t * r.trainingDayKcal() + (7 - t) * r.restDayKcal();
                    assertThat(Math.abs(weekly - 7 * kcal))
                        .as("kcal=%d s=%d t=%d", kcal, s, t)
                        .isLessThanOrEqualTo((t + 1) / 2); // one round() → ≤ T/2 drift
                }
            }
        }
    }

    @Test
    void uniformWhenNoShift_noTrainingDays_allTrainingDays_orFloorEatsItAll() {
        assertThat(DayTypeShiftCalculator.split(2150, 0, 4, BMR).restDayKcal()).isNull();
        assertThat(DayTypeShiftCalculator.split(2150, 200, 0, BMR).restDayKcal()).isNull();
        assertThat(DayTypeShiftCalculator.split(2150, 200, 7, BMR).restDayKcal()).isNull();
        // segment kcal already at the floor → nothing to take from rest days
        assertThat(DayTypeShiftCalculator.split(1720, 200, 4, BMR).restDayKcal()).isNull();
        // null bmr (defensive) → floor of 0, shift applies fully
        assertThat(DayTypeShiftCalculator.split(2150, 200, 4, null).restDayKcal()).isEqualTo(1950);
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='DayTypeShiftCalculatorTest' -DargLine="-Xmx2g"`
Expected: COMPILE ERROR — class does not exist.

- [ ] **Step 3: Implement**

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Slice-3 day-type kcal split (spec §6.4): move {@code shiftKcal} off each rest day onto the
 * training days so the WEEKLY sum is unchanged and the delta lands in carbs (derived at serve
 * time). Rest days are floored at BMR — the floor shrinks the effective shift rather than
 * breaking the weekly invariance. Pure, deterministic, no Spring.
 */
public final class DayTypeShiftCalculator {

    private static final int DAYS_PER_WEEK = 7;

    /** Both fields null ⇔ uniform day (no shift applicable). */
    public record DayTypeKcal(Integer trainingDayKcal, Integer restDayKcal) {
        public static final DayTypeKcal UNIFORM = new DayTypeKcal(null, null);
    }

    private DayTypeShiftCalculator() {
    }

    /**
     * @param segmentKcal  the segment's uniform daily target (kcal)
     * @param shiftKcal    the user's dayTypeShiftKcal setting (kcal off each rest day)
     * @param trainingDays scheduled training days per week for this segment (0..7)
     * @param bmr          the bootstrap BMR — the rest-day floor; null → floor 0 (defensive)
     */
    public static DayTypeKcal split(int segmentKcal, int shiftKcal, int trainingDays, BigDecimal bmr) {
        if (shiftKcal <= 0 || trainingDays <= 0 || trainingDays >= DAYS_PER_WEEK) {
            return DayTypeKcal.UNIFORM;
        }
        int floor = bmr == null ? 0 : bmr.setScale(0, RoundingMode.CEILING).intValueExact();
        int restDayKcal = Math.max(segmentKcal - shiftKcal, floor);
        int effectiveShift = segmentKcal - restDayKcal;
        if (effectiveShift <= 0) {
            return DayTypeKcal.UNIFORM;
        }
        int restDays = DAYS_PER_WEEK - trainingDays;
        int trainingDayKcal = segmentKcal
            + BigDecimal.valueOf((long) effectiveShift * restDays)
                .divide(BigDecimal.valueOf(trainingDays), 0, RoundingMode.HALF_UP)
                .intValueExact();
        return new DayTypeKcal(trainingDayKcal, restDayKcal);
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Same command. Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/DayTypeShiftCalculator.java backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/DayTypeShiftCalculatorTest.java
git commit -m "feat(goal): pure day-type kcal split — weekly-sum invariant, BMR-floored (mezo-XXXX)"
```

---

### Task 5: Wire the split through projection → prescription → wire

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/entity/GoalPrescriptionJson.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/mapper/GoalMapper.java`
- Test: extend `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalProjectionServiceIT.java`

**Interfaces:**
- Consumes: `DayTypeShiftCalculator.split(...)` (Task 4), `WeeklyScheduledActivityService.scheduledTrainingDayOfWeeks(userId)` (Task 3), and slice 1's diet-preferences read in `GoalEngineService` — the single place `evaluate` already fetches the user's diet settings for the split preset. **This slice extends that read with the shift value.** If slice 1's port/record names differ from `dietPreferences.dayTypeShiftKcal()`, adapt mechanically at that one read site.
- Produces: `ProjectionSegment` gains `Integer trainingDayKcal, Integer restDayKcal` (after `dailyEnergyBalanceKcal`); `GoalPrescriptionJson.Segment` gains the same two fields (jsonb-additive — old rows deserialize with nulls); `GoalProjectionService.project(goal, userId, bootstrap, trend, dayTypeShiftKcal)` (new 5th param, `int`).

- [ ] **Step 1: Write the failing IT additions**

Add to `GoalProjectionServiceIT` (reuse its existing seeding helpers — `trainPopulator` seeds gym/sport slots; check its existing tests for the exact populator calls and copy the idiom; the bootstrap comes from the file's `bootstrap()` helper, `bmr 1795`):

```java
    @Test
    void dayTypeShiftSplitsSegmentKcalWeeklyInvariant() {
        // seed: gym slots on 2 weekdays + a sport slot on a 3rd (copy the class's TrainPopulator idiom)
        // → trainingDays = 3, restDays = 4
        GoalEntity goal = goalPopulator.activeCutGoal(); // the class's existing goal seeding idiom
        List<ProjectionSegment> segments =
            service.project(goal, goal.getCreatedBy(), bootstrap(), noTrend(), 200);

        ProjectionSegment seg = segments.get(0);
        int kcal = seg.targetKcal().setScale(0, java.math.RoundingMode.HALF_UP).intValueExact();
        assertThat(seg.restDayKcal()).isEqualTo(Math.max(kcal - 200, 1795)); // floored at ceil(bmr)
        int effective = kcal - seg.restDayKcal();
        assertThat(seg.trainingDayKcal())
            .isEqualTo(kcal + Math.round(effective * 4 / 3f));
        assertThat(3 * seg.trainingDayKcal() + 4 * seg.restDayKcal())
            .isCloseTo(7 * kcal, within(2));
    }

    @Test
    void zeroShiftLeavesDayTypeFieldsNull() {
        GoalEntity goal = goalPopulator.activeCutGoal();
        List<ProjectionSegment> segments =
            service.project(goal, goal.getCreatedBy(), bootstrap(), noTrend(), 0);
        assertThat(segments.get(0).trainingDayKcal()).isNull();
        assertThat(segments.get(0).restDayKcal()).isNull();
    }
```

(`noTrend()` / goal seeding: reuse whatever helper names the class already has — read the file's existing tests first; the two new tests must compile against those real helpers, so adjust the seeding lines, NOT the assertions.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='GoalProjectionServiceIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"`
Expected: COMPILE ERROR — `project` has no 5th param, `ProjectionSegment` has no day-type accessors.

- [ ] **Step 3: Implement — projection**

In `GoalProjectionService`:

1. `ProjectionSegment` record gains `Integer trainingDayKcal, Integer restDayKcal` (insert after `dailyEnergyBalanceKcal`, before `activeSystems`).
2. `project(...)` signature gains `int dayTypeShiftKcal`; fetch the scheduled weekdays once:

```java
    public List<ProjectionSegment> project(
        GoalEntity goal, UUID userId, TdeeBootstrapJson bootstrap, WeightTrendResponse trend,
        int dayTypeShiftKcal) {
        ...
        Set<Integer> scheduledDays = weeklyActivity.scheduledTrainingDayOfWeeks(userId);
```

3. Thread `scheduledDays` + `dayTypeShiftKcal` into `buildSegment(...)`; there, union in the segment's run days and call the calculator:

```java
        // Slice 3: training days for THIS segment = recurring gym/sport weekdays ∪ the active run
        // block's session weekdays in the segment's first week (the sessionsPerWeek fallback idiom).
        Set<Integer> trainingDays = new TreeSet<>(scheduledDays);
        if (ld.runActive()) {
            trainingDays.addAll(runDayOfWeeks(links, runs, from));
        }
        int kcalInt = target.setScale(0, RoundingMode.HALF_UP).intValueExact();
        DayTypeShiftCalculator.DayTypeKcal dayType =
            DayTypeShiftCalculator.split(kcalInt, dayTypeShiftKcal, trainingDays.size(), bootstrap.bmr());
```

(`buildSegment` needs `links`/`runs` passed through — they are locals of `project` today; extend the private signature.) New helper, next to `sessionsPerWeek`:

```java
    /** The run-session weekdays (0=Mon..6=Sun) prescribed in goal-week {@code w}'s block week —
     *  first structure week as fallback, mirroring {@link #sessionsPerWeek}. */
    private Set<Integer> runDayOfWeeks(
        List<GoalPlanLinkEntity> links, Map<UUID, RunningBlockEntity> runs, int w) {
        for (GoalPlanLinkEntity l : links) {
            if (!PLAN_RUNNING_BLOCK.equals(l.getPlanType()) || !covers(l, w)) {
                continue;
            }
            RunningBlockEntity b = runs.get(l.getPlanId());
            if (b == null || b.getStructure() == null || b.getStructure().weeks() == null
                || b.getStructure().weeks().isEmpty()) {
                return Set.of();
            }
            int weekInBlock = w - l.getStartWeek() + 1;
            List<RunWeek> weeks = b.getStructure().weeks();
            RunWeek match = weeks.stream()
                .filter(rw -> rw.weekNumber() != null && rw.weekNumber() == weekInBlock)
                .findFirst().orElse(weeks.get(0));
            if (match.sessions() == null) {
                return Set.of();
            }
            return match.sessions().stream()
                .map(s -> s.dayOfWeek())
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        }
        return Set.of();
    }
```

4. `buildSegment` returns the two extra values in the `ProjectionSegment` constructor call: `dayType.trainingDayKcal(), dayType.restDayKcal()`.

- [ ] **Step 4: Implement — prescription + orchestrator + mapper**

1. `GoalPrescriptionJson.Segment`: add `Integer trainingDayKcal, Integer restDayKcal` after `dailyEnergyBalanceKcal` (jsonb-additive; old persisted rows deserialize with nulls — the demodata `GoalReevaluateRunner` backfills at boot).
2. `GoalEvaluationService.assemble`: copy through — in the `new Segment(...)` call add `seg.trainingDayKcal(), seg.restDayKcal()` in position.
3. `GoalEngineService.evaluate`: pass the shift into `project`. Slice 1 already reads the diet preferences here for the split; extend that read:

```java
        List<ProjectionSegment> segments = projectionService.project(
            goal, userId, bootstrap, trend, dietPreferences.dayTypeShiftKcal());
```

(`dietPreferences` = slice 1's already-injected read; if its record lacks the field, add `int dayTypeShiftKcal` to it and populate from `DietSettingsService.getSettings(userId).getDayTypeShiftKcal()` at its existing assembly point.)
4. `GoalMapper.toSegments`: add `.trainingDayKcal(s.trainingDayKcal())` and `.restDayKcal(s.restDayKcal())` to the builder chain.

- [ ] **Step 5: Run the focused engine gates**

Run: `cd backend && ./mvnw clean test -Dtest='GoalProjectionServiceIT,GoalEvaluationServiceIT,GoalEngineRecomputeIT,GoalContractIT,DayTypeShiftCalculatorTest' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"`
Expected: PASS. (`GoalEvaluationServiceIT`/`GoalContractIT` compile-break if a `new Segment(...)` call site was missed — fix those call sites, never the record.)

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/goal backend/src/test/java/io/mrkuhne/mezo/feature/goal
git commit -m "feat(goal): engine prescribes trainingDayKcal/restDayKcal per segment (mezo-XXXX)"
```

---

### Task 6: Backend serve-time day pick — `FuelDayService`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayDayTypeIT.java` (new)

**Interfaces:**
- Consumes: `WorkoutWindowQueryService.windowsFor(UUID, LocalDate)` (established meal→train dependency, `MealService.java:74` idiom); segment fields from Task 5; slice 1's `seg.carbsG()`/`fatG()` serving in `targetSet`.
- Produces: `GET /api/meal/fuel-day` + `getWeek` serve day-type kcal and the serve-time carb delta; no contract change (the `MacroSet` shape is unchanged — only the numbers move).

- [ ] **Step 1: Write the failing IT**

```java
package io.mrkuhne.mezo.feature.meal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Slice 3: targetSet picks trainingDayKcal on a date with a scheduled workout window and
 * restDayKcal otherwise, deriving the carb delta at serve time (protein/fat constant).
 */
@Transactional
class FuelDayDayTypeIT extends AbstractIntegrationTest {

    @Autowired private FuelDayService fuelDayService;
    @Autowired private GymScheduleSlotRepository gymRepo;
    // + the goal seeding the class needs: seed an ACTIVE goal whose prescription segment covers the
    // queried dates with kcal 2150 / proteinG 163 / carbsG X / fatG Y / trainingDayKcal 2300 /
    // restDayKcal 1950 — copy the goal+prescription seeding idiom from GoalEngineRecomputeIT /
    // GoalPopulator (whichever seeds a persisted prescription directly).

    @Test
    void trainingDayServesTrainingKcalAndCarbDelta() {
        UUID owner = seedGoalWithDayTypeSegment(); // private helper per the note above
        LocalDate monday = LocalDate.of(2026, 6, 1); // inside the goal window, dayOfWeek 0
        GymScheduleSlotEntity g = new GymScheduleSlotEntity();
        g.setCreatedBy(owner);
        g.setDayOfWeek(0);
        g.setTime("17:30");
        gymRepo.save(g);

        FuelDayResponse day = fuelDayService.getDay(owner, monday);
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(2300));
        // carbs = segment carbsG + (2300 − 2150)/4 g; protein/fat unchanged
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() + 38)); // round(150/4)
        assertThat(day.getTargets().getP()).isEqualByComparingTo(BigDecimal.valueOf(163));
    }

    @Test
    void restDayServesRestKcalAndNegativeCarbDelta() {
        UUID owner = seedGoalWithDayTypeSegment();
        LocalDate tuesday = LocalDate.of(2026, 6, 2); // no schedule on dayOfWeek 1
        FuelDayResponse day = fuelDayService.getDay(owner, tuesday);
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(1950));
        assertThat(day.getTargets().getC())
            .isEqualByComparingTo(BigDecimal.valueOf(segmentCarbsG() - 50)); // round(−200/4)
    }

    @Test
    void nullDayTypeFieldsServeTheUniformKcal() {
        UUID owner = seedGoalWithUniformSegment(); // same segment, trainingDayKcal/restDayKcal null
        FuelDayResponse day = fuelDayService.getDay(owner, LocalDate.of(2026, 6, 2));
        assertThat(day.getTargets().getKcal()).isEqualByComparingTo(BigDecimal.valueOf(2150));
    }
}
```

(`seedGoalWithDayTypeSegment`/`seedGoalWithUniformSegment`/`segmentCarbsG` are private helpers of this class: persist a `GoalEntity` with `status="active"`, `startDate 2026-06-01`, and a hand-built `GoalPrescriptionJson` containing one `Segment` — the record is constructible directly; use the slice-1 carbsG/fatG values the helper returns so the assertions share one constant.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && ./mvnw clean test -Dtest='FuelDayDayTypeIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"`
Expected: FAIL — `getKcal()` is 2150 on both days (targetSet ignores the day-type fields).

- [ ] **Step 3: Implement targetSet day pick**

In `FuelDayService`: inject `private final io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService workoutWindowQueryService;` (the `MealService` idiom) and replace the kcal/carb lines of `targetSet` (post-slice-1 shape — the c/f lines already read `seg.carbsG()`/`seg.fatG()`):

```java
    private MacroSet targetSet(GoalEntity goal, LocalDate date, UUID userId) {
        GoalPrescriptionJson.Segment seg = null;
        if (goal != null && goal.getStartDate() != null) {
            long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
            seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        }
        Integer dayKcal = null;
        int carbDeltaG = 0;
        if (seg != null && seg.kcal() != null
            && (seg.trainingDayKcal() != null || seg.restDayKcal() != null)) {
            // Day-type pick (slice 3): a date with any workout window is a training day — the same
            // source set the FE's deriveBlocks/resolveDayType reads (gym slots, sport slots + events
            // + logged sessions, prescribed runs), so both surfaces classify the day identically.
            boolean training = !workoutWindowQueryService.windowsFor(userId, date).isEmpty();
            dayKcal = training ? seg.trainingDayKcal() : seg.restDayKcal();
            if (dayKcal != null) {
                // The whole day-type delta lands in carbs (ISSN); derived at serve time, not stored.
                carbDeltaG = Math.round((dayKcal - seg.kcal()) / 4f);
            }
        }
        Integer kcal = dayKcal != null ? dayKcal : (seg != null && seg.kcal() != null ? seg.kcal() : null);
        return MacroSet.builder()
            .kcal(BigDecimal.valueOf(kcal != null ? kcal : targets.kcal()))
            .p(BigDecimal.valueOf(seg != null && seg.proteinG() != null ? seg.proteinG() : targets.p()))
            .c(BigDecimal.valueOf((seg != null && seg.carbsG() != null ? seg.carbsG() : targets.c()) + carbDeltaG))
            .f(BigDecimal.valueOf(seg != null && seg.fatG() != null ? seg.fatG() : targets.f()))
            .water(BigDecimal.valueOf(targets.water()))
            .build();
    }
```

`targetSet` now needs `userId` — both call sites have it: `getDay(userId, date)` and `getWeek`'s lambda (`targetSet(goal, d, userId)`). Note in the class javadoc that `getWeek` performs 7 window lookups (acceptable single-owner cost; revisit with a week-bulk query only if it ever shows up in traces).

- [ ] **Step 4: Run to verify it passes**

Same command + regression: `-Dtest='FuelDayDayTypeIT,FuelDayServiceIT'` (if a `FuelDayServiceIT`/similar exists — `ls backend/src/test/java/io/mrkuhne/mezo/feature/meal/` and include whatever covers `getDay`).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal/FuelDayDayTypeIT.java
git commit -m "feat(meal): fuel-day targets pick the date's day-type kcal + serve-time carb delta (mezo-XXXX)"
```

---

### Task 7: Frontend — `deriveDailyBudget` day-type composition

**Files:**
- Modify: `frontend/src/features/fuel/logic/buildDayPlan.ts` (deriveDailyBudget + its segment type)
- Modify: `frontend/src/data/fuel/timelineHooks.ts` (currentSegment picks up the new fields; pass `isTrainingDay`)
- Test: `frontend/src/features/fuel/logic/buildDayPlan.test.ts` (extend)

**Interfaces:**
- Consumes: regenerated `api.gen.ts` segment fields (Task 1); `resolveDayType`/`dayType` already computed in `useFuelTimeline` (`timelineHooks.ts:94`).
- Produces: `deriveDailyBudget(segment, fallback, energy?, isTrainingDay?)` — 4th param `boolean | undefined`; `undefined` keeps the uniform (pre-slice-3) behavior so untouched callers/tests stay green. Segment param type gains `trainingDayKcal?: number | null; restDayKcal?: number | null`.

- [ ] **Step 1: Write the failing tests**

Add to `buildDayPlan.test.ts` (match the file's existing describe/fixture style; the segment shape below includes slice 1's carbsG/fatG fields if the landed tests carry them — keep those lines consistent with the file):

```ts
describe('deriveDailyBudget day-type shift (slice 3)', () => {
  const fallback = { kcal: 3100, p: 220, c: 380, f: 95, water: 4000 }
  const segment = { kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516, trainingDayKcal: 2300, restDayKcal: 1950 }
  const gym60 = [{ kind: 'gym' as const, time: '17:30', durationMin: 60, label: 'Gym' }]
  const energyTraining = { bmr: 1720, neat: 1.2, weightKg: 78.6, blocks: gym60 }
  const energyRest = { bmr: 1720, neat: 1.2, weightKg: 78.6, blocks: [] }

  it('training day adds the segment delta on top of actual EAT (no double counting)', () => {
    const b = deriveDailyBudget(segment, fallback, energyTraining, true)
    // maintenance 2064 + eat 471.6 + balance −516 + delta +150 = 2169.6 → 2170
    expect(b.kcal).toBe(2170)
    expect(b.p).toBe(163) // protein untouched by day type
  })

  it('rest day subtracts the delta and the BMR floor still holds', () => {
    const b = deriveDailyBudget(segment, fallback, energyRest, false)
    // maintenance 2064 + 0 − 516 − 200 = 1348 → floored at BMR 1720
    expect(b.kcal).toBe(1720)
  })

  it('undefined isTrainingDay keeps the uniform behavior byte-identical', () => {
    const a = deriveDailyBudget(segment, fallback, energyTraining)
    const legacy = deriveDailyBudget({ kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 }, fallback, energyTraining)
    expect(a).toEqual(legacy)
  })

  it('static path (no profile) uses the day-type kcal as the base', () => {
    const b = deriveDailyBudget(segment, fallback, undefined, true)
    expect(b.kcal).toBe(2300)
    const r = deriveDailyBudget(segment, fallback, undefined, false)
    expect(r.kcal).toBe(1950)
  })

  it('null day-type fields mean uniform on both paths', () => {
    const uniform = { kcal: 2150, proteinG: 163, dailyEnergyBalanceKcal: -516 }
    expect(deriveDailyBudget(uniform, fallback, undefined, true).kcal).toBe(2150)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend && pnpm vitest run src/features/fuel/logic/buildDayPlan.test.ts`
Expected: FAIL — day-type cases return the uniform numbers.

- [ ] **Step 3: Implement**

In `buildDayPlan.ts`, `deriveDailyBudget` (shown against the current file; slice 1 will have already replaced the `FAT_KCAL_SHARE` fat line with segment `fatG` — keep slice 1's fat/carb lines and insert ONLY the marked day-type lines):

```ts
export function deriveDailyBudget(
  segment: {
    kcal: number; proteinG: number; dailyEnergyBalanceKcal?: number
    trainingDayKcal?: number | null; restDayKcal?: number | null   // slice 3
  } | null,
  fallback: MacroSet,
  energy?: EnergyInputs,
  /** Day-type pick (slice 3): true/false applies the segment's training/rest kcal; undefined = uniform. */
  isTrainingDay?: boolean,
): DayBudget {
  // slice 3: the day-type base replaces the uniform segment kcal; delta = reallocation, weekly Σ = 0.
  const dayKcal = segment == null || isTrainingDay === undefined
    ? null
    : (isTrainingDay ? segment.trainingDayKcal : segment.restDayKcal) ?? null
  const baseKcal = dayKcal ?? segment?.kcal ?? fallback.kcal
  const proteinG = segment?.proteinG ?? fallback.p
  const fat = Math.round((baseKcal * FAT_KCAL_SHARE) / 9)          // ← slice 1's fat line stays as landed
  const carbs = (kcal: number) => Math.max(0, Math.round((kcal - proteinG * 4 - fat * 9) / 4))

  if (!energy || energy.bmr == null || energy.neat == null) {
    if (!segment) {
      return { kcal: fallback.kcal, p: fallback.p, c: fallback.c, f: fallback.f, energy: { base: fallback.kcal, activity: 0, balance: 0, target: fallback.kcal } }
    }
    return { kcal: baseKcal, p: proteinG, c: carbs(baseKcal), f: fat, energy: { base: baseKcal, activity: 0, balance: 0, target: baseKcal } }
  }
  const balance = segment?.dailyEnergyBalanceKcal ?? 0
  const dayTypeDelta = dayKcal != null && segment != null ? dayKcal - segment.kcal : 0   // slice 3
  const maintenance = energy.bmr * energy.neat
  const eat = activityKcal(energy.blocks, energy.weightKg)
  const target = Math.max(energy.bmr, maintenance + eat + balance + dayTypeDelta) // KCAL_FLOOR = BMR
  return {
    kcal: Math.round(target),
    p: proteinG,
    c: carbs(target),
    f: fat,
    energy: { base: Math.round(maintenance), activity: Math.round(eat), balance: Math.round(balance), target: Math.round(target) },
  }
}
```

(Note the fat stays tied to `baseKcal`/segment as slice 1 defined and carbs absorb the whole delta via `carbs(target)` — exactly the serve-time carb rule the BE applies.)

In `timelineHooks.ts`:
1. `currentSegment`'s return type + the picked object gain `trainingDayKcal`/`restDayKcal` (they flow off the generated segment type — widen the annotation at `timelineHooks.ts:56`).
2. The `deriveDailyBudget` call (`timelineHooks.ts:103`) gains the 4th arg — `dayType` is computed at line 94, ABOVE the call today; keep that ordering and pass:

```ts
  const budget = deriveDailyBudget(segment, fuel.targets, {
    bmr: goalResponse?.tdeeBootstrap?.bmr ?? null,
    neat: goalResponse?.tdeeBootstrap?.neat ?? null,
    weightKg,
    blocks,
  }, dayType !== 'rest')
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd frontend && pnpm vitest run src/features/fuel/logic/buildDayPlan.test.ts src/data/fuel/timelineHooks.test.tsx`
Expected: PASS (existing timeline tests stay green — their fixtures carry no day-type fields, so `?? null` keeps them uniform).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/logic/buildDayPlan.ts frontend/src/features/fuel/logic/buildDayPlan.test.ts frontend/src/data/fuel/timelineHooks.ts
git commit -m "feat(fuel): day-type kcal delta composes with the actual-EAT budget (mezo-XXXX)"
```

---

### Task 8: Frontend — settings knob + mock parity

**Files:**
- Modify: `frontend/src/features/fuel/sheets/FuelSettingsSheet.tsx` ("Diéta" section from slice 1)
- Modify: slice 1's diet-settings FE plumbing (`frontend/src/data/fuel/dietSettingsApi.ts` + `dietSettingsHooks.ts` — or wherever slice 1 put them; they mirror `fuelSettingsApi`/`fuelSettingsHooks`)
- Modify: slice 1's diet-settings mock seed + `frontend/src/data/me/goals.ts` (segments gain the day-type numbers)
- Test: extend the sheet's/hooks' existing test files (slice 1 created them next to the modified files)

**Interfaces:**
- Consumes: Task 1's regenerated `dayTypeShiftKcal` on `DietSettingsResponse`/`SetDietSettingsRequest`; slice 1's `useDietSettings()`/`useDietSettingsActions()` hooks.
- Produces: a stepper row (0–500, step 50) in the Diéta section; mock fixtures consistent with the engine math (shift 200 ↔ segment numbers below).

- [ ] **Step 1: Write the failing test**

In the FuelSettingsSheet test file (slice 1 extended it for the Diéta section — follow its render/expect idiom):

```tsx
it('edzőnap-shift stepper steps by 50 and saves the value', async () => {
  const user = userEvent.setup()
  render(<FuelSettingsSheet onClose={() => {}} />)          // + the file's existing providers/wrapper
  const plus = await screen.findByRole('button', { name: /Edzőnap-shift növelése/ })
  await user.click(plus)
  expect(screen.getByLabelText('Edzőnap-shift')).toHaveTextContent('50')
  // save → the PUT payload carries dayTypeShiftKcal (assert via the file's existing msw/mock-action spy idiom)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && pnpm vitest run src/features/fuel/sheets/FuelSettingsSheet.test.tsx`
Expected: FAIL — no such button.

- [ ] **Step 3: Implement the knob**

In the Diéta section of `FuelSettingsSheet.tsx`, copy the mealsPerDay stepper row pattern verbatim (ROW/LABEL styles, `touched` guard, disabled bounds):

```tsx
          <div className="row" style={ROW}>
            <span style={LABEL}>Edzőnap-shift</span>
            <div className="row gap-sm" style={{ alignItems: 'center' }}>
              <button type="button" className="chip" aria-label="Edzőnap-shift csökkentése"
                disabled={dayTypeShiftKcal <= 0} onClick={() => { setTouched(true); setDayTypeShiftKcal(v => Math.max(0, v - 50)) }}
                style={{ opacity: dayTypeShiftKcal <= 0 ? 0.4 : 1 }}><Icon name="minus" size={12} /></button>
              <span aria-label="Edzőnap-shift"
                style={{ minWidth: 34, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {dayTypeShiftKcal > 0 ? `${dayTypeShiftKcal} kcal` : 'ki'}
              </span>
              <button type="button" className="chip" aria-label="Edzőnap-shift növelése"
                disabled={dayTypeShiftKcal >= 500} onClick={() => { setTouched(true); setDayTypeShiftKcal(v => Math.min(500, v + 50)) }}
                style={{ opacity: dayTypeShiftKcal >= 500 ? 0.4 : 1 }}><Icon name="plus" size={12} /></button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: 'var(--faint)', margin: 0 }}>
            Pihenőnapról edzőnapra átcsoportosított kcal — a heti keret nem változik, a különbség szénhidrátba megy.
          </p>
```

State + prefill + save mirror the sheet's existing fields (`useState(settings.dayTypeShiftKcal)`, the `useEffect` re-sync list gains it, the save payload gains it). Extend the diet-settings API/hook types with the new field (regenerated types already carry it — mostly a mapping line in `dietSettingsApi.ts` and the hook's ghost object).

- [ ] **Step 4: Mock parity**

1. Slice 1's diet-settings mock seed: `dayTypeShiftKcal: 200`.
2. `frontend/src/data/me/goals.ts` — the two prescription segments gain numbers CONSISTENT with the engine math at shift 200 (T=4, R=3 mock schedule; no floor bite):
   - segment 1 (`kcal: 2150`): `trainingDayKcal: 2300, restDayKcal: 1950,`
   - segment 2 (`kcal: 2380`): `trainingDayKcal: 2530, restDayKcal: 2180,`
3. Any FE fixture that type-fails after the segment type widened (e.g. `timelineHooks.test.tsx:37`, `GoalsPage.test.tsx:71`) stays valid — the fields are optional; only add them where a test asserts day-type behavior.

- [ ] **Step 5: Run the full dual-mode gate**

Run: `cd frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build`
Expected: both modes PASS, build clean. (Known pre-existing reds on main, if any, are listed in the session handoff — everything this slice touched must be green.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "feat(fuel): Edzőnap-shift knob + mock day-type parity (mezo-XXXX)"
```

---

### Task 9: Docs, CODEMAP, final gates

**Files:**
- Modify: `docs/features/fuel.md` (§4 budget derivation + §9 decision log), `docs/features/goal-engine.md` (§3 chain + config/settings inputs, §5 bridges)
- Modify: `docs/CODEMAP.md` (regenerated)

- [ ] **Step 1: Update the two feature docs**

- `goal-engine.md`: the engine's inputs now include `diet_settings.day_type_shift_kcal`; document the split math (copy the formula block from this plan's header), the uniform-day edge cases, and that `Segment` carries `trainingDayKcal`/`restDayKcal`.
- `fuel.md` §4/§9: the day budget is now day-type aware on BOTH surfaces — BE picks by `WorkoutWindowQueryService.windowsFor`, FE by `resolveDayType`; record the "carb delta derived at serve time, not stored" decision and the no-double-counting composition rule (delta vs actual EAT) with the worked example.

- [ ] **Step 2: Regenerate CODEMAP + ArchUnit store check**

Run: `node scripts/gen-codemap.mjs && git status`
Expected: CODEMAP picks up `DayTypeShiftCalculator` + the new test classes; `backend/archunit_store/` shows NO deletions/emptying in `git status` (if it does, restore it: `git checkout -- backend/archunit_store`).

- [ ] **Step 3: Final focused gates**

Run:
```bash
cd backend && ./mvnw clean test -Dtest='DayTypeShiftCalculatorTest,DietSettingsDayTypeShiftIT,WeeklyScheduledActivityTrainingDaysIT,GoalProjectionServiceIT,GoalEvaluationServiceIT,GoalEngineRecomputeIT,GoalContractIT,FuelDayDayTypeIT,GoalReevaluateRunnerIT' -Dmezo.test.use-testcontainers=true -DargLine="-Xmx3g"
cd ../frontend && pnpm test && VITE_USE_MOCK=true pnpm test && pnpm build
```
Expected: all PASS. The full backend suite is CI's job (self-PR gate) — do NOT run it locally.

- [ ] **Step 4: Commit**

```bash
git add docs
git commit -m "docs(fuel,goal): day-type kcal shifting — split math, serve-time carbs, composition rule (mezo-XXXX)"
```

---

## Self-review notes

- **Spec coverage (§6.4):** setting knob (T2, T8) ✓; engine per-segment numbers with weekly-sum invariance + 0/7-training-day edge cases (T4, T5) ✓; protein constant / delta-in-carbs (T6 Step 3, T7 Step 3 — carbs are the remainder on both surfaces) ✓; BE/BE-FE day-classification agreement via workout windows vs resolveDayType (T6, header rationale) ✓; rest-day BMR clamp shared with the FE floor (T4 + T7's existing `Math.max(energy.bmr, …)`) ✓; mock fixtures + both-mode tests (T8) ✓.
- **Cross-slice interface risk:** slice 1's exact names (diet-settings files, port/record, test harness helpers) are consumed in T1/T2/T5/T8 — each names its single adaptation point explicitly instead of pretending to know the landed identifiers.
- **Type consistency:** `dayTypeShiftKcal` (setting), `trainingDayKcal`/`restDayKcal` (segment fields), `DayTypeShiftCalculator.split(...)`, `scheduledTrainingDayOfWeeks(...)`, `deriveDailyBudget(..., isTrainingDay?)` — used with identical names in every task that references them.
