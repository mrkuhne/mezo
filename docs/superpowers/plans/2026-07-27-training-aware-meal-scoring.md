# Training-aware Role-based Meal Scoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deterministic meal score training-aware so a pre-workout high-carb meal is scored as fuel, not penalized — via a meal *role* (standard / pre_workout / post_workout) derived from the day's workout schedule windows.

**Architecture:** A train-owned `WorkoutWindowQueryService` returns the day's workout windows (schedule-slot time + done signal). `MealService` fetches them at log time, a pure classifier in the nutrition slice maps `(logged local time, windows)` → `MealRole`, and `MealScoringService.scoreMeal` selects a role rubric overlay (role-specific macro targets, WHO sugar limit, NOVA softening) for the three role-sensitive dimensions. `standard` = today's exact behavior (zero regression). The role is surfaced in the existing `context` breakdown dimension (renders on the FE with no frontend change).

**Tech Stack:** Java 21, Spring Boot 4.x, Maven, JUnit 5 + AssertJ, Testcontainers/fixed `mezo_test` Postgres, Lombok, `@ConfigurationProperties`.

**Design spec:** `docs/superpowers/specs/2026-07-27-training-aware-meal-scoring-design.md` (mezo-ta8p).

## Global Constraints

- Base package `io.mrkuhne.mezo`; PKs are UUID; single-user ownership via `created_by` set server-side.
- Config only via `@ConfigurationProperties` records (never `@Value`); all tunables under `mezo.*`. Scoring config prefix: `mezo.fuel.scoring`; targets prefix: `mezo.nutrition`.
- DI: constructor injection + `@RequiredArgsConstructor`; `@Transactional` method-level only; services return typed objects (never hand-write boundary DTOs).
- Tests: integration-first (`@SpringBootTest` + fixed `mezo_test` DB, no mocks/H2); AssertJ only; naming `test{Method}_should{Result}_when{Condition}`; data via existing `*Populator` factories.
- `MealScoringService` stays **pure** (no repository access); all DB reads live in `MealService` / the train query service.
- **Zero regression:** `MealRole.STANDARD` must produce byte-for-byte the current v0 score; the recipe/template surface (`recipeTemplateBreakdown`/`recipeFit`) is **unchanged** (context-free baseline).
- Local test commands use `./mvnw clean test` (always `clean` — Lombok/MapStruct incremental is flaky) with `-DargLine=-Xmx3g` for IT classes (the box OOMs otherwise); the authoritative full-suite gate is CI.

---

## File Structure

**Backend — create:**
- `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealRole.java` — the role enum.
- `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryService.java` — day's workout windows (gym/sport/run schedule + done signal).

**Backend — modify:**
- `feature/nutrition/config/MealScoringProperties.java` — add `preLeadMin`, `postTrailMin`, `Roles roles` (`RoleRubric pre/post`).
- `feature/nutrition/service/MealScoringService.java` — nested `WorkoutWindow` input record + static `classifyRole`; role-aware `scoreMeal`; role-effective config threaded into `macroDim`/`whoDim`/`novaDim`; role `context` row.
- `feature/meal/service/MealService.java` — inject the query service; fetch → map → classify → `scoreMeal(..., role)`.
- `backend/src/main/resources/application.yml` — `mezo.fuel.scoring` role + lead/trail values.

**Backend — tests:**
- modify `feature/nutrition/service/MealScoringServiceTest.java` — updated construction + classifier + role rubric tests.
- create `feature/train/service/WorkoutWindowQueryServiceIT.java` — windows query.
- modify `feature/meal/MealApiIT.java` — end-to-end training-aware ITs.

**Docs — modify:** `docs/features/` fuel/meal-scoring doc + `node scripts/lint-docs.mjs`.

**Frontend:** none (the `context` dimension renders generically — `ContextPanel.tsx:13-18`; mapper passes rows through — `mealApi.ts:73-79`).

---

### Task 1: Config — role rubrics + lead/trail window params

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/MealScoringProperties.java`
- Modify: `backend/src/main/resources/application.yml:452-506` (`mezo.fuel.scoring`)
- Modify (keep green): `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java:24-41`

**Interfaces:**
- Produces: `MealScoringProperties.preLeadMin() : int`, `.postTrailMin() : int`, `.roles() : Roles`; `Roles.pre()/post() : RoleRubric`; `RoleRubric.p()/c()/f() : int`, `.who() : WhoRefs`, `.nova() : NovaGroupScores` (all non-null — each role fully specified).

- [ ] **Step 1: Add the `RoleRubric` + `Roles` records and three fields to `MealScoringProperties`.**

Add two nested records (place after the existing `SlotWindows` record, before the closing brace):

```java
    /**
     * A meal-role rubric overlay (mezo-ta8p): the role-sensitive tunables that differ from the
     * standard rubric. Each role is FULLY specified (no partial merge) — the scorer picks these
     * verbatim for pre/post-workout meals; STANDARD uses the base targets/who/nova.
     */
    public record RoleRubric(
        @Min(0) int p,          // role macro target — protein grams/day (feeds macro kcal-shares)
        @Min(0) int c,          // role macro target — carbs grams/day
        @Min(0) int f,          // role macro target — fat grams/day
        @NotNull @Valid WhoRefs who,          // role WHO limits (relaxed sugar for fueling)
        @NotNull @Valid NovaGroupScores nova  // role NOVA class scores (softened processing penalty)
    ) {
    }

    /** Per-role rubric overlays; STANDARD needs none (uses the base rubric). */
    public record Roles(
        @NotNull @Valid RoleRubric pre,
        @NotNull @Valid RoleRubric post
    ) {
    }
```

Add three components to the record header (append after `slotShareTolerance`, add a leading comma):

```java
    @DecimalMin("0.0") @DecimalMax("1.0") double slotShareTolerance,
    /** Minutes BEFORE a workout start within which a meal is pre-workout fuel. */
    @Min(0) @Max(360) int preLeadMin,
    /** Minutes AFTER a workout end within which a meal is post-workout recovery. */
    @Min(0) @Max(360) int postTrailMin,
    @NotNull @Valid Roles roles
```

- [ ] **Step 2: Add the config values to `application.yml`.**

Under `mezo.fuel.scoring:` (after `slot-share-tolerance: 0.4` at `application.yml:506`), add:

```yaml
      # Training-aware role windows (mezo-ta8p): a meal is pre-workout fuel within pre-lead-min
      # before a workout start, post-workout recovery within post-trail-min after its end.
      pre-lead-min: 120
      post-trail-min: 90
      # Per-role rubric overlays. STANDARD uses the base targets/who/nova above (zero regression).
      roles:
        pre:                       # pre-workout: fast carbs are FUEL — carb target up, sugar/NOVA relaxed
          p: 150
          c: 550
          f: 60
          who:
            sugar-energy-share-limit: 0.30   # fueling: free sugar tolerated far higher than WHO 10%
            salt-limit-g: 5
          nova:
            group1: 1.0
            group2: 0.9
            group3: 0.8
            group4: 0.6                       # a gel/toast is processed and FINE pre-workout
        post:                      # post-workout: protein + carb recovery (glycogen)
          p: 300
          c: 480
          f: 70
          who:
            sugar-energy-share-limit: 0.20
            salt-limit-g: 5
          nova:
            group1: 1.0
            group2: 0.88
            group3: 0.7
            group4: 0.45
```

- [ ] **Step 3: Update the unit test's property construction so the module compiles.**

In `MealScoringServiceTest.java`, replace the `props` initializer (lines 24-41) tail — change the final `0.4);` line to include the three new args:

```java
        new MealScoringProperties.SlotWindows(5, 10, 11, 15, 17, 22),
        0.4,
        120,   // preLeadMin
        90,    // postTrailMin
        new MealScoringProperties.Roles(
            new MealScoringProperties.RoleRubric(150, 550, 60,
                new MealScoringProperties.WhoRefs(0.30, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.9, 0.8, 0.6)),
            new MealScoringProperties.RoleRubric(300, 480, 70,
                new MealScoringProperties.WhoRefs(0.20, 5),
                new MealScoringProperties.NovaGroupScores(1.0, 0.88, 0.7, 0.45))));
```

- [ ] **Step 4: Compile + run the existing scorer unit tests to prove nothing broke.**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest`
Expected: PASS (existing tests unchanged; the new config fields are unused so far).

- [ ] **Step 5: Boot-bind smoke — run the config-binding context test if present, else the scorer test suffices.**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest`
Expected: PASS. (Full `@ConfigurationProperties` binding is exercised by any `@SpringBootTest` in later tasks; a startup binding failure would surface there.)

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/config/MealScoringProperties.java \
        backend/src/main/resources/application.yml \
        backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java
git commit -m "feat(fuel): meal-scoring role-rubric + lead/trail config (mezo-ta8p)"
```

---

### Task 2: `MealRole` enum + pure role classifier

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealRole.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java` (add nested `WorkoutWindow` + static `classifyRole`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Produces: `enum MealRole { STANDARD, PRE_WORKOUT, POST_WORKOUT }`.
- Produces: `record MealScoringService.WorkoutWindow(LocalTime start, LocalTime end, boolean done)`.
- Produces: `static MealRole MealScoringService.classifyRole(LocalTime t, List<WorkoutWindow> workouts, int preLeadMin, int postTrailMin)`.

- [ ] **Step 1: Write the failing classifier tests.**

Add to `MealScoringServiceTest.java` (imports: `import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.WorkoutWindow;` and `java.util.List` already present):

```java
    @Test
    void testClassifyRole_shouldBePreWorkout_whenInsideLeadWindow() {
        var gym = new WorkoutWindow(LocalTime.of(14, 30), LocalTime.of(15, 30), false);
        // 13:20 is 70 min before start, inside the 120-min pre-lead
        MealRole role = MealScoringService.classifyRole(LocalTime.of(13, 20), List.of(gym), 120, 90);
        assertThat(role).isEqualTo(MealRole.PRE_WORKOUT);
    }

    @Test
    void testClassifyRole_shouldBeStandard_whenBeforeLeadWindow() {
        var gym = new WorkoutWindow(LocalTime.of(14, 30), LocalTime.of(15, 30), false);
        // 12:00 is 150 min before start, OUTSIDE the 120-min pre-lead
        assertThat(MealScoringService.classifyRole(LocalTime.of(12, 0), List.of(gym), 120, 90))
            .isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testClassifyRole_shouldBePostWorkout_whenInsideTrailAndDone() {
        var gym = new WorkoutWindow(LocalTime.of(9, 0), LocalTime.of(10, 0), true);
        // 10:45 is 45 min after end, inside the 90-min trail, workout DONE
        assertThat(MealScoringService.classifyRole(LocalTime.of(10, 45), List.of(gym), 120, 90))
            .isEqualTo(MealRole.POST_WORKOUT);
    }

    @Test
    void testClassifyRole_shouldBeStandard_whenInTrailButNotDone() {
        var gym = new WorkoutWindow(LocalTime.of(9, 0), LocalTime.of(10, 0), false);
        // in the post window but the workout was NOT done → no recovery bonus
        assertThat(MealScoringService.classifyRole(LocalTime.of(10, 45), List.of(gym), 120, 90))
            .isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testClassifyRole_shouldBeStandard_whenNoWorkouts() {
        assertThat(MealScoringService.classifyRole(LocalTime.of(13, 0), List.of(), 120, 90))
            .isEqualTo(MealRole.STANDARD);
    }

    @Test
    void testClassifyRole_shouldPreferPostDone_whenBetweenDonePriorAndUpcomingWorkout() {
        var morningDone = new WorkoutWindow(LocalTime.of(9, 0), LocalTime.of(10, 0), true);
        var eveningPlanned = new WorkoutWindow(LocalTime.of(11, 30), LocalTime.of(12, 30), false);
        // 10:45: post-window of the DONE morning workout AND pre-window of the planned one → post wins
        assertThat(MealScoringService.classifyRole(
                LocalTime.of(10, 45), List.of(morningDone, eveningPlanned), 120, 90))
            .isEqualTo(MealRole.POST_WORKOUT);
    }
```

- [ ] **Step 2: Run to verify they fail (compile error — symbols missing).**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest`
Expected: FAIL — `cannot find symbol: MealRole` / `WorkoutWindow` / `classifyRole`.

- [ ] **Step 3: Create the `MealRole` enum.**

`feature/nutrition/service/MealRole.java`:

```java
package io.mrkuhne.mezo.feature.nutrition.service;

/**
 * The role a logged meal plays relative to the day's training (mezo-ta8p). Selects the scoring
 * rubric overlay: STANDARD = the base WHO-aligned rubric; PRE_WORKOUT / POST_WORKOUT relax the
 * carb/sugar/NOVA treatment because fast carbs are fuel / recovery, not a dietary sin.
 */
public enum MealRole {
    STANDARD,
    PRE_WORKOUT,
    POST_WORKOUT
}
```

- [ ] **Step 4: Add the `WorkoutWindow` record + `classifyRole` to `MealScoringService`.**

In `MealScoringService.java`, add the nested record next to `ScoredLine` (after line 63):

```java
    /**
     * A workout on the meal's date, reduced to what role-classification needs (mezo-ta8p):
     * the schedule-slot start, the derived end, and whether it was actually done that day
     * (gates the POST_WORKOUT recovery bonus). Owned by the scorer like {@link ScoredLine} so the
     * nutrition slice never depends on the train slice — {@code MealService} maps train windows in.
     */
    public record WorkoutWindow(java.time.LocalTime start, java.time.LocalTime end, boolean done) {
    }
```

Add the pure classifier as a `static` method (place it after `scoreMeal`, before the private dim helpers):

```java
    /**
     * Classifies a logged meal's training role (mezo-ta8p). PRE_WORKOUT when the meal falls in
     * {@code [start - preLeadMin, start)} of any workout (plan-based; looks forward). POST_WORKOUT
     * when it falls in {@code [end, end + postTrailMin]} of a workout that was actually DONE.
     * Multiple qualifying workouts: the nearest by time; a done-post and an upcoming-pre tie
     * resolves to POST_WORKOUT (recovery is the more time-critical need). Otherwise STANDARD.
     */
    public static MealRole classifyRole(LocalTime t, List<WorkoutWindow> workouts,
                                        int preLeadMin, int postTrailMin) {
        MealRole best = MealRole.STANDARD;
        double bestDistance = Double.MAX_VALUE;
        int tMin = t.getHour() * 60 + t.getMinute();
        for (WorkoutWindow w : workouts) {
            int start = w.start().getHour() * 60 + w.start().getMinute();
            int end = w.end().getHour() * 60 + w.end().getMinute();
            if (w.done() && tMin >= end && tMin <= end + postTrailMin) {
                double d = tMin - end;
                if (best != MealRole.POST_WORKOUT || d < bestDistance) { // post always beats a pre tie
                    best = MealRole.POST_WORKOUT;
                    bestDistance = d;
                }
            } else if (tMin >= start - preLeadMin && tMin < start) {
                double d = start - tMin;
                if (best == MealRole.STANDARD && d < bestDistance) { // never override a POST_WORKOUT
                    best = MealRole.PRE_WORKOUT;
                    bestDistance = d;
                }
            }
        }
        return best;
    }
```

- [ ] **Step 5: Run the classifier tests to verify they pass.**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest`
Expected: PASS (all six classifier tests + the pre-existing tests).

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealRole.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java
git commit -m "feat(fuel): MealRole + pure workout-window role classifier (mezo-ta8p)"
```

---

### Task 3: Role-aware rubric in `scoreMeal`

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java`

**Interfaces:**
- Produces: `MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime, MealRole role)` (primary).
- Produces: `MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime)` (3-arg overload → delegates with `MealRole.STANDARD`; existing callers/tests unchanged).
- Consumes: `MealScoringProperties.roles()`, `RoleRubric` (Task 1); `MealRole` (Task 2).

- [ ] **Step 1: Write the failing rubric tests (regression + pre-workout lift).**

Add to `MealScoringServiceTest.java`. Uses the existing private `line(...)` helper (a fully-covered line with facts). A high-sugar, ultra-processed, carb-heavy line is the pre-workout case:

```java
    // A carb-heavy, high-sugar, NOVA-4 line — the "PB Banana Toast" shape.
    private List<ScoredLine> fuelLines() {
        return List.of(new ScoredLine(
            "PB Banana Toast", "1 adag",
            new BigDecimal("237"), new BigDecimal("10"), new BigDecimal("42"), new BigDecimal("3"),
            (short) 4,
            new BigDecimal("8"), new BigDecimal("20"), new BigDecimal("1.0"), new BigDecimal("0.5"),
            true, null, null));
    }

    @Test
    void testScoreMeal_shouldEqualStandardOverload_whenRoleStandard() {
        var lines = fuelLines();
        MealBreakdownJson viaOverload = service.scoreMeal("breakfast", lines, LocalTime.of(6, 13));
        MealBreakdownJson viaRole =
            service.scoreMeal("breakfast", lines, LocalTime.of(6, 13), MealRole.STANDARD);
        assertThat(viaRole.value()).isEqualByComparingTo(viaOverload.value());
    }

    @Test
    void testScoreMeal_shouldNotPenalizeFuel_whenPreWorkout() {
        var lines = fuelLines();
        MealBreakdownJson standard =
            service.scoreMeal("breakfast", lines, LocalTime.of(6, 13), MealRole.STANDARD);
        MealBreakdownJson pre =
            service.scoreMeal("breakfast", lines, LocalTime.of(6, 13), MealRole.PRE_WORKOUT);

        // whole score lifts, and the three role-sensitive dims each lift (or hold) vs standard
        assertThat(pre.value().doubleValue()).isGreaterThan(standard.value().doubleValue());
        assertThat(dimension(pre, "who").score().doubleValue())
            .isGreaterThan(dimension(standard, "who").score().doubleValue());
        assertThat(dimension(pre, "nova").score().doubleValue())
            .isGreaterThan(dimension(standard, "nova").score().doubleValue());
        assertThat(dimension(pre, "macro").score().doubleValue())
            .isGreaterThanOrEqualTo(dimension(standard, "macro").score().doubleValue());
    }

    @Test
    void testScoreMeal_shouldTagRole_whenNonStandard() {
        MealBreakdownJson pre =
            service.scoreMeal("breakfast", fuelLines(), LocalTime.of(6, 13), MealRole.PRE_WORKOUT);
        assertThat(dimension(pre, "context").context())
            .anySatisfy(row -> assertThat(row.label()).isEqualTo("Szerep"));
    }

    @Test
    void testScoreMeal_shouldNotTagRole_whenStandard() {
        MealBreakdownJson std =
            service.scoreMeal("breakfast", fuelLines(), LocalTime.of(6, 13), MealRole.STANDARD);
        assertThat(dimension(std, "context").context())
            .noneSatisfy(row -> assertThat(row.label()).isEqualTo("Szerep"));
    }
```

- [ ] **Step 2: Run to verify they fail.**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest`
Expected: FAIL — `scoreMeal(...)` 4-arg overload not found / no "Szerep" row.

- [ ] **Step 3: Thread role-effective config through `macroDim`/`whoDim`/`novaDim` and add the role-aware `scoreMeal`.**

In `MealScoringService.java`:

(a) Replace the existing `scoreMeal` (lines 73-90) with the overload + role-aware primary:

```java
    /** Backward-compatible entry: scores with no training context (STANDARD rubric). */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime) {
        return scoreMeal(slot, lines, localTime, MealRole.STANDARD);
    }

    /**
     * Scores a logged meal under a training {@link MealRole} (mezo-ta8p). STANDARD uses the base
     * rubric (byte-for-byte the v0 score); PRE/POST_WORKOUT swap in the role's macro targets, WHO
     * sugar limit, and NOVA class scores for the three role-sensitive dimensions — fast carbs are
     * fuel, not a penalty. {@code localTime} is the request's offset-local wall-clock time.
     */
    public MealBreakdownJson scoreMeal(String slot, List<ScoredLine> lines, LocalTime localTime,
                                       MealRole role) {
        double kcal = sum(lines, ScoredLine::kcal);

        int tp = targets.p();
        int tc = targets.c();
        int tf = targets.f();
        MealScoringProperties.WhoRefs who = props.who();
        MealScoringProperties.NovaGroupScores nova = props.nova();
        if (role == MealRole.PRE_WORKOUT || role == MealRole.POST_WORKOUT) {
            MealScoringProperties.RoleRubric r =
                role == MealRole.PRE_WORKOUT ? props.roles().pre() : props.roles().post();
            tp = r.p();
            tc = r.c();
            tf = r.f();
            who = r.who();
            nova = r.nova();
        }

        List<Dim> dims = List.of(
            macroDim(lines, kcal, tp, tc, tf), microDim(lines, kcal), whoDim(lines, kcal, who),
            fatQualityDim(lines, kcal), novaDim(lines, kcal, nova), plantDiversityDim(lines, kcal),
            energyDensityDim(lines, kcal), contextDim(slot, lines, kcal, localTime, role));

        double weightSum = dims.stream().mapToDouble(d -> d.effectiveWeight).sum();
        double value = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.score).sum() / weightSum;
        double confidence = weightSum == 0 ? 0
            : dims.stream().mapToDouble(d -> d.effectiveWeight * d.coverage).sum() / weightSum;

        return new MealBreakdownJson(round2(value), round2(confidence), null,
            dims.stream().map(Dim::toJson).toList(), List.of(),
            tools(slot, lines, dims, localTime));
    }
```

(b) `macroDim` — change signature and the three target reads. Header becomes:

```java
    private Dim macroDim(List<ScoredLine> lines, double kcal, int targetP, int targetC, int targetF) {
```

and replace the three `targets.p()/c()/f()` reads used for the target macro shares (lines 160-163) with the params:

```java
        double targetMacroKcal = targetP * 4 + targetC * 4 + targetF * 9;
        double tp = targetP * 4 / targetMacroKcal;
        double tc = targetC * 4 / targetMacroKcal;
        double tf = targetF * 9 / targetMacroKcal;
```

(Leave `targets.kcal()` on line 170 for `kcalShare` — that's a day-level display value, role-independent.)

(c) `whoDim` — accept the effective refs. Header becomes:

```java
    private Dim whoDim(List<ScoredLine> lines, double kcal, MealScoringProperties.WhoRefs who) {
```

and replace every `props.who()` inside with the local `who` (lines 213, 219, 220, 224, 226, 227, 228).

(d) `novaDim` — accept the effective scores. Header becomes:

```java
    private Dim novaDim(List<ScoredLine> lines, double kcal, MealScoringProperties.NovaGroupScores nova) {
```

and replace `props.nova().of(g)` (line 353) with `nova.of(g)`.

(e) Update the `recipeTemplateBreakdown` call site (lines 120-124) to pass the BASE rubric explicitly (recipe = standard, context-free):

```java
        List<Dim> live = List.of(
            macroDim(perServingLines, kcal, targets.p(), targets.c(), targets.f()),
            microDim(perServingLines, kcal), whoDim(perServingLines, kcal, props.who()),
            fatQualityDim(perServingLines, kcal),
            novaDim(perServingLines, kcal, props.nova()), plantDiversityDim(perServingLines, kcal),
            energyDensityDim(perServingLines, kcal), portionDim(slot, kcal));
```

(f) `contextDim` — accept the role and append a "Szerep" row for non-standard roles. Change the header (line 374) and the `rows` construction (lines 385-391):

```java
    private Dim contextDim(String slot, List<ScoredLine> lines, double kcal, LocalTime localTime,
                           MealRole role) {
```

then after building the existing three `ContextRow`s, wrap them in a mutable list and prepend the role row:

```java
        List<ContextRow> rows = new ArrayList<>();
        if (role != MealRole.STANDARD) {
            rows.add(new ContextRow("Szerep", roleLabel(role)));
        }
        rows.add(new ContextRow("Időzítés", String.format("%s · %s", localTime, timingSub >= 1
            ? slotLabel(slot) + " ablakban" : "a " + slotLabel(slot) + " ablakon kívül")));
        rows.add(new ContextRow("Slot-arány", String.format("%d%% vs ~%d%% cél",
            (int) Math.round(kcal / targets.kcal() * 100), (int) Math.round(slotShare * 100))));
        rows.add(new ContextRow("Fehérje", String.format("%d g / %d g slot-cél",
            Math.round(protein), Math.round(proteinRef))));
```

(`java.util.ArrayList` is already imported.) Add the helper near `slotLabel`:

```java
    private static String roleLabel(MealRole role) {
        return switch (role) {
            case PRE_WORKOUT -> "Pre-workout üzemanyag-ablak";
            case POST_WORKOUT -> "Post-workout regeneráció";
            case STANDARD -> "Általános";
        };
    }
```

- [ ] **Step 4: Run the scorer unit tests to verify pass.**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest`
Expected: PASS — including the regression equality, the pre-workout lift, and the role-tag tests.

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/nutrition/service/MealScoringServiceTest.java
git commit -m "feat(fuel): role-aware meal rubric + Szerep context row (mezo-ta8p)"
```

---

### Task 4: Train `WorkoutWindowQueryService` — the day's workout windows

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryServiceIT.java`

**Interfaces:**
- Produces: `record WorkoutWindowQueryService.Window(LocalTime start, LocalTime end, String kind, boolean done)`.
- Produces: `List<Window> windowsFor(UUID userId, LocalDate date)`.
- Consumes: `GymScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID)`, `SportScheduleSlotRepository.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID)`, `RunningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(UUID,"active")`, `WorkoutSessionRepository.findDoneInstanceDates(UUID,LocalDate,LocalDate)`, `SportSessionRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(UUID,LocalDate)`, `TrainProperties.gymDefaultMinutes()`/`runDefaultMinutes()`.

**Design notes (spec §3.1–3.3):** the day's workouts come from the **weekly schedule slots** matched by the meal date's weekday (`date.getDayOfWeek().getValue() - 1` → the slot `dayOfWeek` 0=Mon..6=Sun). Gym end = start + `gymDefaultMinutes`; sport end = start + `durationMin`; run end = start + `runDefaultMinutes`. Gym `done` = the date is in `findDoneInstanceDates`; sport `done` = a sport session exists on the date; run `done` = deferred (v1: run windows are pre-only → `done=false`, documented). Times parse from the `HH:mm` slot strings.

- [ ] **Step 1: Write the failing IT for gym windows (pre schedule + done flag).**

`feature/train/service/WorkoutWindowQueryServiceIT.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.config.OwnerProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class WorkoutWindowQueryServiceIT extends AbstractIntegrationTest {

    @Autowired private WorkoutWindowQueryService service;
    @Autowired private TrainPopulator train;
    @Autowired private OwnerProperties ownerProperties;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testWindowsFor_shouldReturnGymWindow_whenSlotOnThatWeekday() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);      // Wednesday → dayOfWeek index 2
        train.createGymSlot(owner, 2, "14:30");

        List<WorkoutWindowQueryService.Window> windows = service.windowsFor(owner, wed);

        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().start()).isEqualTo(LocalTime.of(14, 30));
        assertThat(windows.getFirst().kind()).isEqualTo("gym");
        assertThat(windows.getFirst().done()).isFalse();   // no completed instance seeded
    }

    @Test
    void testWindowsFor_shouldReturnEmpty_whenNoSlotOnThatWeekday() {
        UUID owner = owner();
        train.createGymSlot(owner, 2, "14:30");                 // Wednesday slot
        LocalDate thu = LocalDate.of(2026, 6, 25);              // Thursday → index 3
        assertThat(service.windowsFor(owner, thu)).isEmpty();
    }
}
```

- [ ] **Step 2: Run to verify it fails.**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutWindowQueryServiceIT -DargLine=-Xmx3g`
Expected: FAIL — `WorkoutWindowQueryService` does not exist.
(Prereq: `docker compose up -d` in `backend/` so `mezo_test` is reachable.)

- [ ] **Step 3: Implement the service.**

`feature/train/service/WorkoutWindowQueryService.java`:

```java
package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.TrainProperties;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the workout windows for a user's given date (mezo-ta8p): the weekly schedule-slot
 * time matched by the date's weekday, its derived end, and a done signal for post-workout gating.
 * Mirrors {@link WeeklyScheduledActivityService}'s repo wiring but groups by weekday. Consumed by
 * the meal scorer (via MealService) to classify a logged meal's pre/post-workout role.
 */
@Service
@RequiredArgsConstructor
public class WorkoutWindowQueryService {

    private final GymScheduleSlotRepository gymRepo;
    private final SportScheduleSlotRepository sportRepo;
    private final RunningBlockRepository runningBlockRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final TrainProperties props;

    /** One workout on a date: schedule start, derived end, kind, and whether it was actually done. */
    public record Window(LocalTime start, LocalTime end, String kind, boolean done) {
    }

    @Transactional(readOnly = true)
    public List<Window> windowsFor(UUID userId, LocalDate date) {
        int dow = date.getDayOfWeek().getValue() - 1;   // slot tables use 0=Mon..6=Sun
        List<Window> windows = new ArrayList<>();

        boolean gymDone = workoutSessionRepository
            .findDoneInstanceDates(userId, date, date).contains(date);
        gymRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .forEach(s -> {
                LocalTime start = LocalTime.parse(s.getTime());
                windows.add(new Window(start, start.plusMinutes(props.gymDefaultMinutes()),
                    "gym", gymDone));
            });

        boolean sportDone = sportSessionRepository
            .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, date)
            .stream().anyMatch(ss -> date.equals(ss.getDate()));
        sportRepo.findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(userId).stream()
            .filter(s -> s.getDayOfWeek() == dow)
            .forEach(s -> {
                LocalTime start = LocalTime.parse(s.getTime());
                windows.add(new Window(start, start.plusMinutes(s.getDurationMin()),
                    "sport", sportDone));
            });

        runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst()
            .ifPresent(block -> addRunWindows(block, dow, windows));

        return windows;
    }

    /** Today's prescribed run(s) in the block's current week (run windows are pre-only in v1). */
    private void addRunWindows(RunningBlockEntity block, int dow, List<Window> windows) {
        RunningBlockStructure structure = block.getStructure();
        if (structure == null || structure.weeks() == null) {
            return;
        }
        structure.weeks().stream()
            .filter(w -> w.weekNumber() != null && w.weekNumber().equals(block.getCurrentWeek()))
            .flatMap(w -> w.sessions().stream())
            .filter(s -> s.dayOfWeek() != null && s.dayOfWeek() == dow && s.timeOfDay() != null)
            .forEach(s -> {
                LocalTime start = LocalTime.parse(s.timeOfDay());
                windows.add(new Window(start, start.plusMinutes(props.runDefaultMinutes()),
                    "run", false));
            });
    }
}
```

- [ ] **Step 4: Run the IT to verify pass.**

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutWindowQueryServiceIT -DargLine=-Xmx3g`
Expected: PASS (both gym window tests).

- [ ] **Step 5: Add a post-done gym test (proves the done flag flips).**

Append to `WorkoutWindowQueryServiceIT.java`:

```java
    @Test
    void testWindowsFor_shouldMarkGymDone_whenCompletedInstanceOnDate() {
        UUID owner = owner();
        LocalDate wed = LocalDate.of(2026, 6, 24);
        train.createGymSlot(owner, 2, "09:00");
        var meso = train.createActiveMeso(owner);
        var day = train.createTemplateDay(owner, meso.getId(), "Sze");
        train.createWorkoutInstance(owner, day, wed, "completed");

        var windows = service.windowsFor(owner, wed);
        assertThat(windows).hasSize(1);
        assertThat(windows.getFirst().done()).isTrue();
    }
```

Run: `cd backend && ./mvnw clean test -Dtest=WorkoutWindowQueryServiceIT -DargLine=-Xmx3g`
Expected: PASS. (If `createWorkoutInstance`/`createTemplateDay`/`createActiveMeso` argument types differ from `TrainPopulator`, adjust to the verbatim signatures: `createActiveMeso(UUID)`, `createTemplateDay(UUID,UUID,String)`, `createWorkoutInstance(UUID,WorkoutSessionEntity,LocalDate,String)`.)

- [ ] **Step 6: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/train/service/WorkoutWindowQueryServiceIT.java
git commit -m "feat(train): WorkoutWindowQueryService — day's workout windows for scoring (mezo-ta8p)"
```

---

### Task 5: Wire `MealService` — fetch → classify → score

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java` (`applyScore`, lines 161-169; add the field)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Consumes: `WorkoutWindowQueryService.windowsFor(UUID, LocalDate)` (Task 4); `MealScoringService.classifyRole(...)`, `scoreMeal(..., MealRole)`, `WorkoutWindow` (Tasks 2-3); `MealScoringProperties.preLeadMin()/postTrailMin()` (Task 1).

- [ ] **Step 1: Write the failing end-to-end ITs.**

Add to `MealApiIT.java` (owner id via the same pattern the file already uses for auth; seed the gym slot on the meal's weekday). The file's `mealReq(...)` logs a **breakfast** meal at instant `2026-06-24T13:20Z` (a Wednesday, local 13:20). Seed a gym slot at 14:30 Wed → 13:20 is pre-workout (70 min lead < 120):

```java
    @Test
    void testCreate_shouldScoreAsPreWorkoutFuel_whenGymSlotAfterMeal() {
        HttpHeaders auth = ownerAuthHeaders();
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        // NOVA-4, high-sugar, carb-heavy food (fuel shape)
        PantryItemRequest r = new PantryItemRequest();
        r.setKind(PantryItemRequest.KindEnum.FOOD);
        r.setName("Mézes banán toast");
        r.setPer(new BigDecimal("100"));
        r.setUnit("g");
        r.setKcal(new BigDecimal("250"));
        r.setProteinG(new BigDecimal("6"));
        r.setCarbsG(new BigDecimal("48"));
        r.setFatG(new BigDecimal("3"));
        r.setNova(4);
        r.setFiberG(new BigDecimal("4"));
        r.setSugarG(new BigDecimal("22"));
        r.setSaltG(new BigDecimal("0.4"));
        r.setSaturatedFatG(new BigDecimal("0.6"));
        UUID food = postForBody("/api/pantry", r, auth, HttpStatus.CREATED, PantryItemResponse.class)
            .getId();

        // no gym slot yet → standard score
        MealResponse standard = postForBody(
            "/api/meal", mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);
        BigDecimal standardScore = standard.getScore().getValue();

        // seed a gym slot at 14:30 on Wednesday (meal date 2026-06-24), re-log → pre-workout
        train.createGymSlot(owner, 2, "14:30");
        MealResponse pre = postForBody(
            "/api/meal", mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);

        assertThat(pre.getScore().getValue().doubleValue())
            .isGreaterThan(standardScore.doubleValue());
        assertThat(pre.getScore().getBreakdown().getDimensions())
            .filteredOn(d -> "context".equals(d.getId()))
            .flatExtracting(d -> d.getContext())
            .anySatisfy(row -> assertThat(row.getLabel()).isEqualTo("Szerep"));
    }

    @Test
    void testCreate_shouldScoreStandard_whenNoWorkoutThatDay() {
        HttpHeaders auth = ownerAuthHeaders();
        databasePopulator.populateUser(ownerProperties.ownerEmail());   // owner exists, no slots
        UUID food = createFood(auth, "Zabpehely", 1);   // NOVA-1 with facts (existing helper)

        MealResponse res = postForBody(
            "/api/meal", mealReq(pantryItem(food, "100")), auth, HttpStatus.CREATED, MealResponse.class);

        // no workout day → no Szerep row (standard rubric)
        assertThat(res.getScore().getBreakdown().getDimensions())
            .filteredOn(d -> "context".equals(d.getId()))
            .flatExtracting(d -> d.getContext())
            .noneSatisfy(row -> assertThat(row.getLabel()).isEqualTo("Szerep"));
    }
```

Add the fields to `MealApiIT` if not present:

```java
    @Autowired private io.mrkuhne.mezo.support.populator.TrainPopulator train;
    @Autowired private io.mrkuhne.mezo.config.OwnerProperties ownerProperties;
```

(If `createFood(auth, name, nova)` has a different arity in the file, use the existing `createFood(...)` helper verbatim — it seeds a NOVA-1 food with facts.)

- [ ] **Step 2: Run to verify they fail.**

Run: `cd backend && ./mvnw clean test -Dtest=MealApiIT -DargLine=-Xmx3g`
Expected: FAIL — the pre-workout meal scores the same as standard (no wiring yet) / no "Szerep" row.

- [ ] **Step 3: Wire the query service + classifier into `MealService.applyScore`.**

In `MealService.java`, add the constructor dependency (the class is `@RequiredArgsConstructor`; add the field alongside `scoringService`):

```java
    private final io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService workoutWindowQueryService;
    private final io.mrkuhne.mezo.feature.nutrition.config.MealScoringProperties scoringProperties;
```

Replace `applyScore` (lines 161-169) body's scoring call:

```java
    private void applyScore(UUID userId, MealEntity meal, OffsetDateTime loggedAt) {
        List<ScoredLine> lines = meal.getItems().stream()
            .map(item -> toScoredLine(userId, item))
            .toList();
        List<MealScoringService.WorkoutWindow> windows = workoutWindowQueryService
            .windowsFor(userId, meal.getMealDate()).stream()
            .map(w -> new MealScoringService.WorkoutWindow(w.start(), w.end(), w.done()))
            .toList();
        MealRole role = MealScoringService.classifyRole(loggedAt.toLocalTime(), windows,
            scoringProperties.preLeadMin(), scoringProperties.postTrailMin());
        MealBreakdownJson breakdown =
            scoringService.scoreMeal(meal.getSlot(), lines, loggedAt.toLocalTime(), role);
        meal.setBreakdown(breakdown);
        meal.setScore(breakdown.value());
    }
```

Add imports at the top of `MealService.java`:

```java
import io.mrkuhne.mezo.feature.nutrition.service.MealRole;
```

(`MealScoringService` and `MealBreakdownJson` are already imported.)

- [ ] **Step 4: Run the meal ITs to verify pass.**

Run: `cd backend && ./mvnw clean test -Dtest=MealApiIT -DargLine=-Xmx3g`
Expected: PASS — the pre-workout meal now outscores the standard one and carries the "Szerep" row; the no-workout meal has no role row. Existing `MealApiIT` tests still pass (no workout seeded → STANDARD → unchanged scores).

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java
git commit -m "feat(meal): classify pre/post-workout role at log time and score accordingly (mezo-ta8p)"
```

---

### Task 6: Feature doc + focused gate

**Files:**
- Modify: the meal-scoring feature doc under `docs/features/` (the Fuel or meal-scoring doc — find it in Step 1).
- Run: `node scripts/lint-docs.mjs`

- [ ] **Step 1: Locate the feature doc that describes meal scoring.**

Run: `grep -rl "meal.score\|MealScoring\|AI score\|mezo-yta\|breakdown" docs/features/`
Expected: the Fuel feature doc (e.g. `docs/features/fuel.md`) — the one whose `key_files` include `MealScoringService`.

- [ ] **Step 2: Update the doc's behavior + file-map sections.**

Add a subsection documenting: the meal role (standard/pre_workout/post_workout), how it's derived (`WorkoutWindowQueryService` schedule windows + done signal, classified by `MealScoringService.classifyRole` against `preLeadMin`/`postTrailMin`), the role rubric overlay (macro targets + WHO sugar limit + NOVA softening; standard = zero regression), that the recipe/template surface stays context-free, and that the role surfaces as the "Szerep" `context` row. Add `WorkoutWindowQueryService.java` + `MealRole.java` to the doc's `key_files`.

- [ ] **Step 3: Clear the staleness flag.**

Run: `node scripts/lint-docs.mjs`
Expected: no errors; the touched doc's staleness flag cleared.

- [ ] **Step 4: Focused backend gate (the classes this change touched).**

Run: `cd backend && ./mvnw clean test -Dtest=MealScoringServiceTest,WorkoutWindowQueryServiceIT,MealApiIT -DargLine=-Xmx3g`
Expected: PASS. (The authoritative full-suite gate is CI on the self-PR — see the Git Workflow in CLAUDE.md.)

- [ ] **Step 5: Commit.**

```bash
git add docs/features/
git commit -m "docs(fuel): document training-aware role-based meal scoring (mezo-ta8p)"
```

---

## Self-Review

**Spec coverage:**
- §2 hybrid step-1 deterministic, role-based, pre+post, standard=zero-regression → Tasks 1-5; regression asserted in Task 3 (`testScoreMeal_shouldEqualStandardOverload...`) and Task 5 (no-workout meal). ✓
- §3.1 schedule-slot source (gym/sport/run) → Task 4. ✓
- §3.2 post requires done; pre is plan-based; nullable→standard → Task 4 (done flags; run pre-only) + Task 2 (classifier done-gate, empty→standard). ✓
- §3.3 windows + precedence (post beats pre tie) → Task 2 classifier + its `shouldPreferPostDone` test. ✓
- §4 role overlay on macro/who/nova, weights unchanged, standard=identity, others role-independent → Task 3. ✓
- §5 layering (train query → MealService → pure scorer), pure scorer → Tasks 4-5; scorer stays DB-free. ✓
- §6 role in `context` row, no contract change → Task 3 (Szerep row) + confirmed FE renders generically (no FE task). ✓
- §7 config additions under `mezo.fuel.scoring` → Task 1. ✓
- §8 unit classification + integration pre/rest/post-done/post-not-done → Tasks 2, 4, 5. ✓
- §9 out-of-scope (name bug mezo-u68c, LLM coach mezo-mr4n, recipe-fit role, card chip) → not in plan; recipe surface explicitly kept standard in Task 3(e). ✓

**Placeholder scan:** no TBD/TODO; every code step carries real code; role override constants are concrete config values (tunable but present, not placeholders). ✓

**Type consistency:** `classifyRole(LocalTime, List<WorkoutWindow>, int, int)`, `WorkoutWindow(LocalTime,LocalTime,boolean)` (nutrition) vs `Window(LocalTime,LocalTime,String,boolean)` (train) — mapped explicitly in Task 5 Step 3. `scoreMeal(..., MealRole)` used consistently in Tasks 3 & 5. `RoleRubric.p()/c()/f()/who()/nova()` defined in Task 1, consumed in Task 3. ✓

**Note for the implementer:** the run-window `done` flag is `false` in v1 (pre-only for runs) by design (spec §3.2 run-done deferred); if a later task adds run-done, add a `RunSessionLogRepository` by-date read. Sport-`done` uses the `>= date` finder filtered to the exact date (no exact-date finder exists).
