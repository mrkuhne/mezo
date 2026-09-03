# Diet Plan Slice 2 — Consistency Repairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the three silent inconsistencies honest: meal scoring judges against the goal's prescribed targets (not static config), training-schedule edits recompute the goal prescription (no more stale EAT), and the prescription's sleep target comes from the user's real sleep goal (not a hardcoded 8.0).

**Architecture:** A nutrition-owned `DailyTargets` carrier threads goal-resolved targets into the pure `MealScoringService` (resolved by `FuelDayService`, passed by `MealService`); a train-owned `GoalRecomputePort` (ADR 0012 consumer-owned port) lets schedule mutations trigger `GoalEngineService.recomputeActiveGoal` without a new train→goal package edge; a sleep-owned `SleepTargetPort` feeds `sleepTargetH` into the (still pure) `GoalEvaluationService.assemble` via the orchestrator.

**Tech Stack:** Spring Boot backend (feature slices: nutrition, meal, goal/engine, train, biometrics/sleep), JUnit 5 + AssertJ, Testcontainers ITs. No frontend or contract (yml) changes.

**Spec:** `docs/superpowers/specs/2026-09-02-diet-plan-design.md` (§6.3)

**Depends on slice 1** (`2026-09-02-diet-plan-slice-1` — Diet split foundations): `GoalPrescriptionJson.Segment` carries `Integer carbsG` and `Integer fatG`, and `FuelDayService.targetSet` already serves them with `NutritionTargetsProperties` fallback. If slice 1 has NOT landed, Task 2's segment reads of `carbsG()`/`fatG()` must be dropped (kcal/p from segment, c/f from config) and re-added when slice 1 lands — everything else in this plan is independent.

## Global Constraints

- Language: all code, comments, commit messages in ENGLISH; user-facing note strings in the goal engine stay Hungarian (existing convention).
- Conventional commit subjects carry the driving bd id: `feat(nutrition): ... (mezo-XXXX)` — replace `mezo-XXXX` with the slice's actual bd issue id.
- NEVER run the full backend suite locally (16 GB OOM) — only the focused test commands given per task. CI is the authoritative gate.
- No contract (`api/**/*.yml`) changes in this slice — if you find yourself editing one, stop: something is off-plan.
- New backend files → regenerate the codemap before the final commit: `node scripts/gen-codemap.mjs` (CI has a `--check` gate).
- Before EVERY commit: `git status` and verify `backend/src/test/resources/archunit-store/**` is unchanged EXCEPT where Task 4 explicitly expects a store update — a green run can silently empty the store (known trap).
- Config-first: any new tunable goes through a `@Validated @ConfigurationProperties` record, never `@Value` or a hardcoded constant.
- Cross-feature reads/writes follow ADR 0012 consumer-owned ports; do not add a `train → goal` or new `nutrition → meal` import.

---

### Task 1: `DailyTargets` carrier + goal-aware rubric in `MealScoringService`

The scorer stays pure: it receives the day's resolved targets as a parameter instead of reading `NutritionTargetsProperties` directly. The old config-based entrypoints remain as delegating overloads (recipe surfaces are date-less and keep config behavior).

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DailyTargets.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Consumes: `NutritionTargetsProperties` (existing record: `kcal, p, c, f, water`).
- Produces: `record DailyTargets(int kcal, int p, int c, int f, String source)` with `static DailyTargets fromConfig(NutritionTargetsProperties t)` (source `"config"`) — Task 2 constructs goal-sourced instances with source `"goal"`. New overload `scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime, MealRole role, DailyTargets base)` — Task 2's `MealService` calls this.

- [ ] **Step 1: Write the failing tests**

Append to `MealScoringServiceTest.java` (the existing `targets`/`props`/`service` fields and `lunchLines()` helper are already there; import `io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.MacroDetail` is already covered by the `MealBreakdownJson` import):

```java
    @Test
    void testScoreMeal_shouldUseProvidedDailyTargets_whenBaseGiven() {
        // A cutting-goal day: 2400 kcal, 180/240/70 g. The same lunch must be judged
        // against THESE shares, not the static 3100/220/380/95 config.
        DailyTargets base = new DailyTargets(2400, 180, 240, 70, "goal");

        MealBreakdownJson withGoal =
            service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0), MealRole.STANDARD, base);
        MealBreakdownJson withConfig =
            service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0), MealRole.STANDARD);

        MealBreakdownJson.Dimension goalMacro = withGoal.dimensions().get(0);
        MealBreakdownJson.Dimension configMacro = withConfig.dimensions().get(0);
        assertThat(goalMacro.id()).isEqualTo("macro");
        // The target shares differ (config P share ≈ 26%, goal P share ≈ 29%) → different score.
        assertThat(goalMacro.score()).isNotEqualTo(configMacro.score());
        // kcalShareOfDay uses the goal kcal: (800+285)/2400 ≈ 45.2%, not (…)/3100 ≈ 35.0%.
        assertThat(goalMacro.macro().kcalShareOfDay()).isEqualByComparingTo(new BigDecimal("45.2"));
    }

    @Test
    void testScoreMeal_shouldMatchConfigOverload_whenBaseIsFromConfig() {
        // The delegating overload and an explicit config-derived base are byte-identical.
        MealBreakdownJson explicit = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0),
            MealRole.STANDARD, DailyTargets.fromConfig(targets));
        MealBreakdownJson implicit = service.scoreMeal("lunch", lunchLines(), LocalTime.of(13, 0));

        assertThat(explicit).isEqualTo(implicit);
    }

    @Test
    void testScoreMeal_shouldKeepRoleRubric_whenPrePostWithGoalBase() {
        // PRE/POST rubrics are role-absolute config bundles — a goal base must NOT change the
        // macro targets they judge against, only the day-share denominators (kcalShare, slot kcal).
        DailyTargets base = new DailyTargets(2400, 180, 240, 70, "goal");
        List<WorkoutWindow> windows = List.of(
            new WorkoutWindow(LocalTime.of(15, 0), LocalTime.of(16, 0), false));
        MealRole role = MealScoringService.classifyRole(LocalTime.of(14, 0), windows, 120, 90);
        assertThat(role).isEqualTo(MealRole.PRE_WORKOUT);

        MealBreakdownJson b =
            service.scoreMeal("snack", lunchLines(), LocalTime.of(14, 0), role, base);
        // The pre-workout macro target label comes from the role rubric (150/550/60), whose
        // protein share is 150·4 / (150·4+550·4+60·9) ≈ 18%.
        assertThat(b.dimensions().get(0).macro().targetP()).isEqualTo("~18%");
    }
```

Note on `targetP()`: check `MealBreakdownJson.MacroDetail`'s actual accessor names before running (the record fields are visible in `MealBreakdownJson.java`); adjust the assertion to the real component name (`tp`/`targetP`/similar) — the VALUE asserted stays `"~18%"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest=MealScoringServiceTest -pl . -q`
Expected: COMPILATION ERROR — `DailyTargets` does not exist, no 5-arg `scoreMeal` overload.

- [ ] **Step 3: Create `DailyTargets`**

```java
package io.mrkuhne.mezo.feature.nutrition.service;

import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;

/**
 * The day's resolved macro targets the scorer judges against (mezo-XXXX, diet-plan slice 2).
 * Nutrition-owned carrier so {@link MealScoringService} stays pure and never resolves goals
 * itself — the caller (meal slice) supplies it. {@code source} feeds the provenance tool row:
 * {@code "config"} (static fallback) or {@code "goal"} (active-goal prescription segment).
 */
public record DailyTargets(int kcal, int p, int c, int f, String source) {

    public static DailyTargets fromConfig(NutritionTargetsProperties t) {
        return new DailyTargets(t.kcal(), t.p(), t.c(), t.f(), "config");
    }
}
```

- [ ] **Step 4: Thread `DailyTargets` through `MealScoringService`**

In `MealScoringService.java`:

1. Add the new public overload and make the existing 4-arg `scoreMeal` delegate:

```java
    /** Config-fallback entry: scores against the static mezo.nutrition targets. */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role) {
        return scoreMeal(slot, lines, localTime, role, DailyTargets.fromConfig(targets));
    }

    /**
     * Scores against the RESOLVED day targets (mezo-XXXX): the goal's prescription segment when
     * one covers the meal's date, else the config fallback — the caller resolves, the scorer
     * stays pure. The role rubric (PRE/POST absolute macro bundles) is unaffected; {@code base}
     * replaces every former {@code mezo.nutrition} read: the STANDARD macro targets and all
     * day-share denominators (kcalShareOfDay, slot kcal budgets, slot protein references).
     */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role, DailyTargets base) {
```

2. Change `rubricFor` to take the base (STANDARD arm only):

```java
    private Rubric rubricFor(MealRole role, DailyTargets base) {
        if (role == MealRole.PRE_WORKOUT || role == MealRole.POST_WORKOUT) {
            MealScoringProperties.RoleRubric r =
                role == MealRole.PRE_WORKOUT ? props.roles().pre() : props.roles().post();
            return new Rubric(r.p(), r.c(), r.f(), r.who(), r.nova());
        }
        return new Rubric(base.p(), base.c(), base.f(), props.who(), props.nova());
    }
```

3. Mechanically replace every `targets.kcal()` / `targets.p()` read inside the scoring paths with `base.kcal()` / `base.p()`, threading `DailyTargets base` as a parameter down the private helpers that need it. The full list of sites (current line numbers): `macroDim` caller's `kcalShare` (`kcal / targets.kcal()` at ~275) → pass `base` into `macroDim` and use `base.kcal()`; `microDim` (~299, ~306); `whoDim` (~325, ~331); `contextDim` (~483, ~486, ~498 — both `targets.kcal()` and `targets.p()`); `portionDim` (~416). Each helper gains a `DailyTargets base` parameter.

4. The template/recipe surface keeps config behavior: `recipeTemplateBreakdown(String, List, MealRole)` internally calls the private dims with `DailyTargets.fromConfig(targets)` (recipes are date-less — an explicit goal-aware template surface is out of scope). The two 2-arg/3-arg `recipeFit`/`recipeTemplateBreakdown` public signatures do not change.

5. Provenance honesty: in `tools(...)` change the hardcoded row to reflect the basis — thread `base` in and emit:

```java
        tools.add(new ToolRow("compute", "macroFit(" + base.source() + ")"));
```

and in `recipeTemplateBreakdown`'s inline tool rows change `"macroFit(mezo.nutrition)"` to `"macroFit(config)"`.

6. Keep the `private final NutritionTargetsProperties targets;` field — it now serves only the `fromConfig` delegations.

- [ ] **Step 5: Run the test class**

Run: `cd backend && ./mvnw test -Dtest=MealScoringServiceTest -q`
Expected: PASS — all pre-existing tests still green (they exercise the delegating overloads, which must stay byte-identical), plus the three new ones.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/DailyTargets.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java
git commit -m "feat(nutrition): meal scorer judges against resolved DailyTargets, config becomes the fallback (mezo-XXXX)"
```

---

### Task 2: `FuelDayService.dailyTargets` + goal-aware wiring in `MealService.applyScore`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/FuelDayService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (applyScore, ~line 171)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/service/FuelDayServiceIT.java` (check first whether this IT exists — if the day-target ITs live in a different class, e.g. `MealServiceIT`/`FuelDayIT`, add the test there in the same style; the test body below is self-contained either way)

**Interfaces:**
- Consumes: `DailyTargets` + 5-arg `scoreMeal` from Task 1; `GoalPrescriptionJson.currentSegment(prescription, week)` (existing); slice 1's `Segment.carbsG()`/`Segment.fatG()`.
- Produces: `public DailyTargets dailyTargets(UUID userId, LocalDate date)` on `FuelDayService` — resolves the active goal's covering segment; per-field fallback to config. (Task 2 is the last consumer-facing change; Tasks 3–4 don't call it.)

- [ ] **Step 1: Write the failing IT**

Locate the existing IT covering `FuelDayService.targetSet`/`getDay` (search: `grep -rn "targetSet\|getDay" backend/src/test/java/io/mrkuhne/mezo/feature/meal/`). Add to that class (using its existing fixture helpers for creating an owner, an active goal with a prescription, and the IT base class idiom used throughout `backend/src/test`):

```java
    @Test
    void testDailyTargets_shouldReadGoalSegment_whenActiveGoalCoversDate() {
        // given an active goal whose prescription segment for week 1 prescribes 2400/180/240/70
        UUID owner = seedOwner();
        GoalEntity goal = seedActiveGoal(owner, LocalDate.now().minusDays(3)); // startDate in week 1
        goal.setPrescription(new GoalPrescriptionJson(
            OffsetDateTime.now(), "formula",
            List.of(new GoalPrescriptionJson.Segment(1, 6, "Alap", 2400, 180,
                new BigDecimal("8.0"), List.of(), null, -300, "seed", 240, 70)),
            null, new GoalPrescriptionJson.Feasibility("feasible", List.of())));
        goalRepository.save(goal);

        DailyTargets t = fuelDayService.dailyTargets(owner, LocalDate.now());

        assertThat(t.kcal()).isEqualTo(2400);
        assertThat(t.p()).isEqualTo(180);
        assertThat(t.c()).isEqualTo(240);
        assertThat(t.f()).isEqualTo(70);
        assertThat(t.source()).isEqualTo("goal");
    }

    @Test
    void testDailyTargets_shouldFallBackToConfig_whenNoActiveGoal() {
        UUID owner = seedOwner();

        DailyTargets t = fuelDayService.dailyTargets(owner, LocalDate.now());

        assertThat(t.kcal()).isEqualTo(3100);
        assertThat(t.p()).isEqualTo(220);
        assertThat(t.c()).isEqualTo(380);
        assertThat(t.f()).isEqualTo(95);
        assertThat(t.source()).isEqualTo("config");
    }
```

IMPORTANT — segment constructor: the `Segment(...)` argument order above assumes slice 1 appended `carbsG, fatG` as the LAST two components. Verify against the actual slice-1 `GoalPrescriptionJson.Segment` record declaration and match its component order exactly. If slice 1 has not landed, drop the two trailing args and the `c`/`f` assertions become 380/95 (config passthrough).

`seedOwner()`/`seedActiveGoal(...)`: reuse the class's existing helpers; if none exist, copy the goal-seeding idiom from `GoalEvaluationServiceIT` (owner UUID + `GoalEntity` with `trajectory="cut"`, `status="active"`, `startDate`, `startWeightKg`).

- [ ] **Step 2: Run the IT to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=<the IT class name> -q`
Expected: COMPILATION ERROR — no `dailyTargets` method.

- [ ] **Step 3: Implement `dailyTargets` and refactor `targetSet` over one shared resolver**

In `FuelDayService.java` — one segment resolution, two projections:

```java
    /** The active goal's segment covering {@code date}'s goal-week; null when none applies. */
    private GoalPrescriptionJson.Segment segmentFor(GoalEntity goal, LocalDate date) {
        if (goal == null || goal.getStartDate() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
    }

    /**
     * The day's resolved macro targets for the meal scorer (mezo-XXXX): the active goal's
     * covering segment, per-field config fallback — the SAME resolution {@link #targetSet}
     * serves the MacroHero, so the score and the hero can never judge against different numbers.
     */
    public DailyTargets dailyTargets(UUID userId, LocalDate date) {
        GoalPrescriptionJson.Segment seg = segmentFor(activeGoal(userId), date);
        if (seg == null) {
            return DailyTargets.fromConfig(targets);
        }
        return new DailyTargets(
            seg.kcal() != null ? seg.kcal() : targets.kcal(),
            seg.proteinG() != null ? seg.proteinG() : targets.p(),
            seg.carbsG() != null ? seg.carbsG() : targets.c(),
            seg.fatG() != null ? seg.fatG() : targets.f(),
            "goal");
    }
```

Refactor the existing `targetSet(GoalEntity goal, LocalDate date)` to call `segmentFor(goal, date)` instead of its inline week math (behavior unchanged; it keeps its own `MacroSet` assembly including water). Add the imports (`DailyTargets`).

- [ ] **Step 4: Wire `MealService.applyScore`**

In `MealService.applyScore` (~line 181), replace the score call:

```java
        DailyTargets base = fuelDayService.dailyTargets(userId, meal.getMealDate());
        MealBreakdownJson breakdown =
            scoringService.scoreMeal(meal.getSlot(), lines, loggedAt.toLocalTime(), role, base);
```

(`fuelDayService` is already injected; add the `DailyTargets` import.)

- [ ] **Step 5: Run the focused ITs**

Run: `cd backend && ./mvnw test -Dtest=<the IT class from step 1>,MealServiceIT -q` (drop `MealServiceIT` if no such class exists — find the meal-create IT with `grep -rln "applyScore\|MealRequest" backend/src/test/java/io/mrkuhne/mezo/feature/meal/ | head -3` and run those).
Expected: PASS. If a pre-existing meal IT asserts an exact `score`/`breakdown` value AND seeds an active goal, its expected numbers may legitimately shift — inspect each such failure, confirm the new number is the goal-judged one, and update the assertion with a comment `// goal-aware rubric since mezo-XXXX`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/ backend/src/test/java/io/mrkuhne/mezo/feature/meal/
git commit -m "feat(meal): meal score judges against the goal's prescribed day targets (mezo-XXXX)"
```

---

### Task 3: Schedule mutations recompute the active goal (train-owned port)

`goal → train` already exists (`GoalEngineService` imports `WeeklyScheduledActivityService`), so a direct `train → goal` import would close a NEW slice cycle and fail `ArchitectureTest.feature_slices_are_cycle_free`. Per ADR 0012: train owns the port, goal provides the adapter.

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/GoalRecomputePort.java`
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/TrainGoalRecomputeAdapter.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java` (add `recomputeActiveGoal`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightLogService.java` (delegate to it)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/SportService.java` (`replaceSchedule`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/GymScheduleService.java` (`replaceSchedule`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/RunningService.java` (`activateBlock`, `closeBlock`, `deleteBlock`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ScheduleGoalRecomputeIT.java` (new)

**Interfaces:**
- Consumes: `GoalEngineService.evaluate(UUID, UUID)` (existing), `GoalRepository.findByCreatedByAndStatusAndDeletedFalse(UUID, String)` (existing).
- Produces: `interface GoalRecomputePort { void recomputeActiveGoal(UUID userId); }` (train-owned); `public void recomputeActiveGoal(UUID userId)` on `GoalEngineService`.

- [ ] **Step 1: Write the failing IT**

Create `ScheduleGoalRecomputeIT.java` in the train test package, following the repo's IT base-class idiom (copy the class-level setup from an existing train IT, e.g. the one covering `SportService` — find it: `grep -rln "replaceSchedule" backend/src/test/java | head -3`). Seed: owner + complete biometric profile + one weigh-in + an ACTIVE goal (copy the seeding idiom from `GoalEvaluationServiceIT`); then:

```java
    @Test
    void testReplaceSportSchedule_shouldRecomputeActiveGoalPrescription_whenScheduleChanges() {
        // given an evaluated active goal (prescription generated at T0)
        goalEngineService.evaluate(owner, goalId);
        OffsetDateTime before = goalRepository.findById(goalId).orElseThrow()
            .getPrescription().generatedAt();

        // when the weekly sport schedule gains a 90-minute slot (weekly EAT changes)
        SportScheduleSlotInput slot = new SportScheduleSlotInput();
        slot.setDayOfWeek(2);
        slot.setTime("18:00");
        slot.setDurationMin(90);
        slot.setKind("training");
        sportService.replaceSchedule(owner, List.of(slot));

        // then the prescription was regenerated (newer generatedAt) — the EAT is no longer stale
        OffsetDateTime after = goalRepository.findById(goalId).orElseThrow()
            .getPrescription().generatedAt();
        assertThat(after).isAfter(before);
    }

    @Test
    void testReplaceSportSchedule_shouldNotThrow_whenNoActiveGoal() {
        // a schedule edit must never depend on having a goal (mirrors the weigh-in rule)
        UUID lonely = seedOwnerWithoutGoal();
        SportScheduleSlotInput slot = new SportScheduleSlotInput();
        slot.setDayOfWeek(3);
        slot.setTime("07:00");
        slot.setDurationMin(60);
        slot.setKind("training");

        assertThatCode(() -> sportService.replaceSchedule(lonely, List.of(slot)))
            .doesNotThrowAnyException();
    }

    @Test
    void testGymScheduleAndRunningLifecycle_shouldRecompute_whenMutated() {
        goalEngineService.evaluate(owner, goalId);
        OffsetDateTime t0 = prescriptionGeneratedAt();

        GymScheduleSlotInput gym = new GymScheduleSlotInput();
        gym.setDayOfWeek(1);
        gym.setTime("17:00");
        gymScheduleService.replaceSchedule(owner, List.of(gym));
        OffsetDateTime t1 = prescriptionGeneratedAt();
        assertThat(t1).isAfter(t0);

        UUID blockId = seedRunningBlock(owner); // planned block, copy the running IT seeding idiom
        runningService.activateBlock(owner, blockId);
        OffsetDateTime t2 = prescriptionGeneratedAt();
        assertThat(t2).isAfter(t1);

        runningService.closeBlock(owner, blockId);
        OffsetDateTime t3 = prescriptionGeneratedAt();
        assertThat(t3).isAfter(t2);
    }
```

(`prescriptionGeneratedAt()` = a private helper reading the goal row as above. `SportScheduleSlotInput`/`GymScheduleSlotInput` setter names: verify against the generated DTOs — grep `class SportScheduleSlotInput` under `backend/target/generated-sources` or check an existing IT using them.)

- [ ] **Step 2: Run the IT to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=ScheduleGoalRecomputeIT -q`
Expected: FAIL — `generatedAt` unchanged (`after` equals `before`), because no recompute is triggered yet.

- [ ] **Step 3: Add `recomputeActiveGoal` to `GoalEngineService` and delegate from `WeightLogService`**

In `GoalEngineService.java` (it already injects `GoalRepository`):

```java
    private static final String STATUS_ACTIVE = "active";

    /**
     * Recompute the owner's single ACTIVE goal (if any) — graceful no-op when none is active.
     * The shared body of every "an engine input moved" trigger (weigh-in, profile, schedule edits);
     * extracted from WeightLogService so the trigger set can grow without copy-paste (mezo-XXXX).
     */
    @Transactional
    public void recomputeActiveGoal(UUID userId) {
        List<GoalEntity> active =
            goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, STATUS_ACTIVE);
        if (active.isEmpty()) {
            return;
        }
        evaluate(userId, active.get(0).getId());
    }
```

In `WeightLogService.java`: delete its private `recomputeActiveGoal` method and the `STATUS_ACTIVE` constant, replace the call at line 45 with `goalEngineService.recomputeActiveGoal(createdBy);`, and remove the now-unused `GoalRepository` injection + imports (`GoalEntity`, `GoalRepository`).

- [ ] **Step 4: Create the train-owned port + goal-owned adapter**

`GoalRecomputePort.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): train's schedule mutations must trigger a goal-prescription
 * recompute (the weekly EAT is derived from the SCHEDULE, so a schedule edit otherwise leaves a
 * stale prescription — mezo-XXXX), but goal → train already exists
 * ({@code WeeklyScheduledActivityService}), so a direct train → goal import would close a new
 * slice cycle. Train owns this seam; the goal slice provides the adapter.
 */
public interface GoalRecomputePort {

    /** Recompute the owner's active goal, if any — must be graceful (no goal → no-op, never throw). */
    void recomputeActiveGoal(UUID userId);
}
```

`TrainGoalRecomputeAdapter.java`:

```java
package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.train.service.GoalRecomputePort;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Goal-side adapter for train's {@link GoalRecomputePort} (ADR 0012 — see the port's javadoc). */
@Component
@RequiredArgsConstructor
public class TrainGoalRecomputeAdapter implements GoalRecomputePort {

    private final GoalEngineService goalEngineService;

    @Override
    public void recomputeActiveGoal(UUID userId) {
        goalEngineService.recomputeActiveGoal(userId);
    }
}
```

- [ ] **Step 5: Trigger from the five mutation sites**

Inject `private final GoalRecomputePort goalRecomputePort;` into `SportService`, `GymScheduleService`, and `RunningService`, and add the call as the LAST statement before the return (inside the existing `@Transactional`, joining the caller's transaction — the recompute-triggers pattern from goal-engine.md §3):

- `SportService.replaceSchedule` — after the sort, before `return`:
  ```java
        // The weekly EAT is schedule-derived → a schedule edit must recompute the prescription
        // (G5 trigger, mezo-XXXX). Graceful when no goal is active.
        goalRecomputePort.recomputeActiveGoal(createdBy);
  ```
- `GymScheduleService.replaceSchedule` — same placement, same comment.
- `RunningService.activateBlock`, `closeBlock`, `deleteBlock` — same call before each `return` (delete included: removing an active block changes the run EAT the same way closing does; a planned-block delete recomputes to the same prescription, harmlessly).

Do NOT touch `logSportSession`/`logSession` — logged actuals never feed the energy model (that question is explicitly deferred in the spec, §8).

- [ ] **Step 6: Run the IT + the neighbors it could break**

Run: `cd backend && ./mvnw test -Dtest=ScheduleGoalRecomputeIT -q`
Expected: PASS.

Then the touched slices' existing focused tests (find the exact class names first with `ls backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/weight/`):
Run: `cd backend && ./mvnw test -Dtest='io.mrkuhne.mezo.feature.train.service.*,io.mrkuhne.mezo.feature.biometrics.weight.**' -q`
Expected: PASS — pre-existing schedule ITs run without an active goal, and the trigger is a graceful no-op there.

- [ ] **Step 7: Run the architecture test — the cycle rule must stay green**

Run: `cd backend && ./mvnw test -Dtest=ArchitectureTest -q`
Expected: PASS with NO change under `backend/src/test/resources/archunit-store/` (`git status` must show the store untouched — the port direction was chosen precisely so no new cycle appears).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/ \
        backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ \
        backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/weight/service/WeightLogService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/train/service/ScheduleGoalRecomputeIT.java
git commit -m "feat(train): schedule edits recompute the active goal prescription via a train-owned port (mezo-XXXX)"
```

---

### Task 4: `sleepTargetH` from the user's real sleep goal

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepTargetPort.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/service/SleepAnchorResolver.java` (implement it)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEngineService.java` (resolve + pass)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationService.java` (assemble gains the param)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java` (existing — extend)

**Interfaces:**
- Consumes: `SleepGoalRepository.findByCreatedByAndDeletedFalse(UUID)`, `SleepGoalProperties.defaultTargetMin()` (existing).
- Produces: `interface SleepTargetPort { BigDecimal targetHours(UUID userId); }` (sleep-owned, mirrors `SleepAnchorPort`); `GoalEvaluationService.assemble(goal, weightKg, bodyFatPct, segments, guards, sleepTargetH)` — the 6th param is new.

Direction note: `goal → biometrics` imports already exist in `GoalEngineService` (profile + weight repositories) — biometrics↔goal is the FROZEN tolerated cycle. This task adds one more dependency in the SAME direction on the SAME slice pair. Step 5 verifies the frozen store's reaction; if the store flags it, the update is deliberate and reviewed.

- [ ] **Step 1: Write the failing test**

`GoalEvaluationService` is pure — extend its IT (or add a plain unit test in the same class if the IT constructs the service directly; match the existing style found in `GoalEvaluationServiceIT.java`). The behavioral claim: `assemble` writes the PASSED sleep target onto every segment.

```java
    @Test
    void testAssemble_shouldCarryProvidedSleepTarget_whenSegmentsEmitted() {
        // given a 7.5h sleep target resolved from the user's sleep goal (port-resolved upstream)
        GoalPrescriptionJson rx = evaluationService.assemble(
            goal, new BigDecimal("90"), null, segments, guards, new BigDecimal("7.5"));

        assertThat(rx.segments()).isNotEmpty();
        assertThat(rx.segments()).allSatisfy(s ->
            assertThat(s.sleepTargetH()).isEqualByComparingTo(new BigDecimal("7.5")));
    }
```

(Reuse the class's existing `goal`/`segments`/`guards` fixtures; if the existing tests call the 5-arg `assemble`, this test won't compile yet — that IS the failing state.)

And the port's resolution rule, in a new plain unit test `SleepTargetResolverTest` next to the sleep services (`SleepAnchorResolver` is constructor-injectable — pure-utility test style, no Spring):

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SleepTargetResolverTest {

    private final SleepGoalRepository repository = mock(SleepGoalRepository.class);
    private final SleepGoalProperties properties =
        new SleepGoalProperties(480, "WAKE", "06:30", "22:30", 15);
    private final SleepAnchorResolver resolver = new SleepAnchorResolver(repository, properties);

    @Test
    void testTargetHours_shouldDeriveFromGoalRow_whenGoalExists() {
        UUID user = UUID.randomUUID();
        SleepGoalEntity g = new SleepGoalEntity();
        g.setTargetMinutes(450); // 7.5 h
        g.setAnchor("WAKE");
        g.setAnchorTime("06:30");
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.of(g));

        assertThat(resolver.targetHours(user)).isEqualByComparingTo(new BigDecimal("7.5"));
    }

    @Test
    void testTargetHours_shouldGhostFromConfig_whenNoGoalRow() {
        UUID user = UUID.randomUUID();
        when(repository.findByCreatedByAndDeletedFalse(user)).thenReturn(Optional.empty());

        assertThat(resolver.targetHours(user)).isEqualByComparingTo(new BigDecimal("8.0")); // 480 min
    }
}
```

(Verify the `SleepGoalProperties` constructor arg order against the record — `defaultTargetMin, defaultAnchor, defaultWake, defaultBed, regularityBandMin` — and `SleepGoalEntity`'s setters before running; mockito is already on the test classpath — confirm with `grep -rn "org.mockito" backend/pom.xml | head -2`, and if it is NOT, convert to a tiny fake repository class instead.)

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && ./mvnw test -Dtest=SleepTargetResolverTest,GoalEvaluationServiceIT -q`
Expected: COMPILATION ERROR — no `targetHours`, no 6-arg `assemble`.

- [ ] **Step 3: Sleep side — port + implementation**

`SleepTargetPort.java`:

```java
package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Read seam for the nightly sleep target in hours — the goal engine seeds the prescription's
 * {@code sleepTargetH} from here (mezo-XXXX; replaces the hardcoded 8.0 seed). Config-ghost when
 * no sleep-goal row exists (never null), mirroring {@link SleepAnchorPort}.
 */
public interface SleepTargetPort {

    BigDecimal targetHours(UUID userId);
}
```

In `SleepAnchorResolver.java`: change the declaration to `implements SleepAnchorPort, SleepTargetPort` and add:

```java
    @Override
    public BigDecimal targetHours(UUID userId) {
        int minutes = repository.findByCreatedByAndDeletedFalse(userId)
            .map(SleepGoalEntity::getTargetMinutes)
            .orElse(properties.defaultTargetMin());
        return BigDecimal.valueOf(minutes)
            .divide(BigDecimal.valueOf(60), 1, RoundingMode.HALF_UP);
    }
```

(add imports: `SleepGoalEntity`, `BigDecimal`, `RoundingMode`).

- [ ] **Step 4: Goal side — resolve in the orchestrator, pass into pure assembly**

`GoalEvaluationService.java`:
- `assemble` signature gains the trailing param `BigDecimal sleepTargetH`; the segment loop uses it instead of the constant.
- Delete `DEFAULT_SLEEP_TARGET_H` and its javadoc line; update the class javadoc sentence about the seed (`sleepTargetH` now arrives port-resolved).
- Defensive fallback inside `assemble` (pure, no I/O): `BigDecimal sleep = sleepTargetH == null ? new BigDecimal("8.0") : sleepTargetH;` — the port contract says never-null, but the pure core must not NPE on a careless caller.

`GoalEngineService.java`:
- Inject `private final SleepTargetPort sleepTargetPort;` (import `io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepTargetPort`).
- In `evaluate`, before the assemble call: `BigDecimal sleepTargetH = sleepTargetPort.targetHours(userId);` and pass it as the 6th argument.

- [ ] **Step 5: Run the focused tests + the architecture gate**

Run: `cd backend && ./mvnw test -Dtest=SleepTargetResolverTest,GoalEvaluationServiceIT,ArchitectureTest -q`
Expected: tests PASS. For `ArchitectureTest`: the new `goal → biometrics.sleep` dependency lies inside the already-frozen biometrics↔goal cycle. Then check `git status`:
- Store unchanged → done.
- Store CHANGED → inspect the diff. Acceptable: ONLY new lines describing the goal→biometrics sleep-port dependency added to the existing biometrics↔goal cycle entry. Anything else (deleted entries, emptied files) is the known silent-corruption trap — restore with `git checkout backend/src/test/resources/archunit-store` and investigate before proceeding. If the diff is the acceptable additive kind, commit it WITH this task and say so in the commit body.

- [ ] **Step 6: Verify other `assemble` callers compile**

Run: `cd backend && ./mvnw test-compile -q` — `assemble` is called from `GoalEngineService` only (verify: `grep -rn "\.assemble(" backend/src/main/java | grep -v GoalEngineService` should return nothing; if a test calls the 5-arg form, update it to pass `new BigDecimal("8.0")`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/biometrics/sleep/ \
        backend/src/main/java/io/mrkuhne/mezo/feature/goal/engine/service/ \
        backend/src/test/java/io/mrkuhne/mezo/feature/biometrics/sleep/ \
        backend/src/test/java/io/mrkuhne/mezo/feature/goal/engine/service/GoalEvaluationServiceIT.java
# plus backend/src/test/resources/archunit-store/ ONLY if step 5 accepted an additive diff
git commit -m "feat(goal): prescription sleep target reads the user's sleep goal via a sleep-owned port (mezo-XXXX)"
```

---

### Task 5: Docs + codemap + close-out

**Files:**
- Modify: `docs/features/goal-engine.md` (§3 trigger table + §5 seams + the stale §9 lines)
- Modify: `docs/features/fuel.md` (§5 Goal→Fuel seam: scoring now goal-aware)
- Regenerate: `docs/CODEMAP.md` (new files: `DailyTargets`, `GoalRecomputePort`, `TrainGoalRecomputeAdapter`, `SleepTargetPort`, tests)

- [ ] **Step 1: Update the feature docs**

`goal-engine.md`:
- §3 recompute-trigger table: add rows for sport-schedule replace, gym-schedule replace, running-block activate/close/delete (caller: `GoalRecomputePort` → `TrainGoalRecomputeAdapter` → `GoalEngineService.recomputeActiveGoal`).
- §5: the `sleepTargetH → Sleep` line moves from "emitted-but-unconsumed / seeded 8.0" to "port-resolved from `sleep_goal.targetMinutes` (ghost 8.0 via `mezo.sleep.default-target-min`)".
- §9: the "protein guard deferred because Fuel intake logging doesn't exist" rationale is stale — reword to reflect that meal logging exists and scoring is now goal-aware; the guard leg itself (`proteinMonitored=false`) is still future work (that leg is slice 5 territory, keep it listed as deferred with the corrected reason).

`fuel.md` §5 (Goal→Fuel seam): add that `MealScoringService` judges the macro dimension and all day-share denominators against `FuelDayService.dailyTargets` (goal segment, config fallback) since this slice.

- [ ] **Step 2: Regenerate the codemap**

Run: `node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check`
Expected: check passes.

- [ ] **Step 3: Final verification sweep**

Run: `cd backend && ./mvnw test -Dtest=MealScoringServiceTest,ScheduleGoalRecomputeIT,SleepTargetResolverTest,GoalEvaluationServiceIT,ArchitectureTest -q` (plus the Task 2 IT class).
Expected: all PASS. `git status`: no unexpected archunit-store or `.beads` noise staged.

- [ ] **Step 4: Commit**

```bash
git add docs/features/goal-engine.md docs/features/fuel.md docs/CODEMAP.md
git commit -m "docs(goal-engine): record the schedule recompute triggers, sleep-port seam, goal-aware scoring (mezo-XXXX)"
```
