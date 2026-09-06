# Proactive Coaching Round 2 · S4 — Meal-Rhythm Drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `meal_rhythm_drift` flag — the round-2 spec's item (13) — so that a meal-slot plan which has quietly stopped matching reality (a slot that actually lives 90+ minutes away from its planned time, or a planned slot that stays empty while the others are logged) produces **one neutral observation card** offering to adjust the plan, and nothing else ever does.

**Architecture:** Slice S4 of `docs/superpowers/specs/2026-09-05-proactive-coaching-round2-design.md` §a / §(13). One new `FlagRule` in `companion/flags/service/rule/`, called by the existing fixed-order `FlagEvaluator` sweep, with cross-feature repository reads (fuel `meal_slot_template`, meal `meal`, train `workout_session`) in the accepted `ProtocolLapseRule`/`LoggingGapRule` style. Delivery is entirely unchanged: `FlagRaisedEvent` → `InterventionEventListener` → intervention library → advice card, day gate and severity contest included.

**Tech Stack:** Spring Boot backend (`backend/`), Liquibase SQL changesets, JUnit ITs extending `AbstractIntegrationTest`. **No frontend work in this slice.**

**Driving issue:** `mezo-d58h.7.4` (child of `mezo-d58h.7`). Branch: `feat/proactive-round2-s4-meal-rhythm-drift`.

---

## The three things that make this slice dangerous

**1. A planned slot has no time unless its anchor is `fixed`.** `MealSlotJson` flattens the anchor: `anchorType ∈ {fixed, wake, training_start, training_end, bed}`, and only `fixed` carries a `time` string. The relative anchors are resolved **in the frontend only** (`frontend/src/features/fuel/logic/compileTemplate.ts`) against that day's wake/bed/training blocks — the backend has never resolved them and this slice must not start. **Consequence:** the *slot-drift* arm only ever looks at `fixed`-anchor slots. The *dead-slot* arm needs no time at all and therefore covers every non-snack slot. Re-implementing `compileTemplate` here would mean inventing a wake time for every past day — exactly the "config-default ghost" trap the spec's terrain section warns about.

**2. The day's template is chosen by day type, and day type is derived.** `meal_slot_template` has one live row per `(owner, dayType)` with `dayType ∈ {rest, training_am, training_pm}`. Nothing stores "what type was 2026-08-30". The derivation convention already exists and **must be copied, not re-invented**: `frontend/src/features/fuel/logic/resolveDayType.ts` — no training blocks ⇒ `rest`; otherwise the EARLIEST block start before noon ⇒ `training_am`, at/after noon ⇒ `training_pm`. The backend equivalent reads completed gym instances (`WorkoutSessionRepository.findDoneInstancesBetween`) and their `startedAt`. A training day whose instances all have a null `startedAt` is **unresolvable and skipped entirely** (it never enters any denominator) — never silently bucketed into one of the two training types. A day whose resolved type has no template row is skipped the same way.

**3. Clock arithmetic wraps.** Deviation is `actual − planned` in minutes-of-day, and both a 07:00-planned breakfast logged at 13:00 and a 19:00-planned dinner logged at 00:30 blow up naive subtraction (+360 vs −1110 when the truth is +360 vs +330). Use the **signed circular difference** helper in this plan verbatim — the result always lands in `(-720, +720]`. Do NOT reach for `LateEatingRule`'s `+24-below-noon` shift: that shift exists to compare two values against ONE anchor on one number line, and it is the wrong tool for a per-slot difference (it turns the breakfast case above into −18 hours). All times are **wall clock in the system zone** (`loggedAt.atZone(ZoneId.systemDefault())`), per the spec's timezone note.

And the standing trap: a new `FlagKey` needs **five runtime-only mirrors** (bd memory `adding-a-flagkey-needs-five-mirrored-changes`) plus, since `mezo-6269.1`, a **sixth** on `companion_flag_trace`. Task 2 does all of them at once.

---

## Decisions already made — do not re-litigate

- **One flag key, two sub-triggers, one payload record with a `subType` discriminator** (`"slot_drift"` / `"dead_slot"`). The spec says one flag; splitting into two keys would double the severity table, the CHECK list, the library entries and the cooldown budget for one editorial idea ("your plan and your reality have drifted apart").
- **A slot is identified by its `slotKind`, not its `label`.** `slotKind ∈ {breakfast, lunch, dinner, snack}` is the same vocabulary as `MealEntity.slot` (`api/feature/fuel/fuel.yml:227` vs the `meal.slot` DB CHECK), so the join is exact and label-rename-proof.
- **`snack` slots are excluded from both arms.** A template may hold several snack slots and every one of them collapses onto the same `meal.slot = 'snack'` rows: "which snack was this" is unanswerable, so both a drift median and a presence ratio would be fiction. Same reasoning drops any day whose template holds **two slots of the same non-snack kind** — that day contributes nothing for that kind rather than guessing.
- **Aggregation is per `slotKind` ACROSS day types.** Each day's deviation is measured against *that day's own* template time, so a 07:00 rest-day breakfast and an 06:00 training-day breakfast contribute comparable deviations. This is what dissolves the day-type problem instead of fragmenting the sample.
- **The day's actual time for a slot is the EARLIEST meal row of that kind that day.** A plan slot names one eating event; if the user logged two dinners, the first one is the one the plan is about.
- **Window ends YESTERDAY, never today** (`MissedWorkoutsRule` / `ProtocolLapseRule` precedent). Today's dinner has not happened at sweep time, and counting it would make every day's presence ratio a function of the hour the sweep ran.
- **Cooldown is key-level 14 days (336h), not per-item.** Unlike S1's per-ITEM protocol cooldown, this rule announces at most one slot per raise and the whole point is that it should speak rarely. That means the intervention-library entry's `cooldown-hours` **MUST also be 336** — S1's whole-branch review lesson was that `InterventionService.deliverForFlag` applies the library entry's own per-key cooldown, so a shorter or longer value there silently overrides the design.
- **Severity rank: directly after `protocol_lapse`, still ahead of the setup checks.** It is an offer to edit a plan, not a health signal — it must never displace a sleep-debt or bad-day card. The existing order does not change at all.
- **`meal_rhythm_drift` stays COUNTED in `existsProblemRaiseSince`** (it does not join the `all_healthy` carve-out list). It is a genuine observation about the user's own behaviour, like `late_eating` — not a data gap or an app-side failure.
- **Channel is `feed`.** No push for "your dinner actually happens at 21:00".
- **No frontend, no contract, no new endpoint.** The card ships on machinery that already exists end to end.

---

## Global Constraints

- **Honesty gate is the default**: no template rows, too few days with meals, no trackable slot ⇒ `FlagVerdict.unavailable(...)` with a named `UnavailableReason`; never a raise, never a fabricated clear. Every gate gets its own silence test.
- **An unlogged day is never "compliant" and never "violating."** A day with no meals at all does not count as a dead-slot day for anybody: presence ratios are computed over days the slot was PLANNED *and* the day had at least one logged meal of any kind. Otherwise a 5-day logging holiday would read as "your dinner slot died".
- **Every threshold is config** (`FlagProperties`, Bean-Validation ranges, `application.yml` defaults). No numbers in the rule class.
- `FlagEvaluator` has **no `List<FlagRule>` injection** — add a field and a call line in the fixed order, immediately after `protocolLapseRule`. `AllHealthyRule` stays last.
- Liquibase changesets are immutable; the two new files are timestamped after the newest existing one (`202609061200_mezo-d58h.7.2_companion_message_hydration_kind.sql`) and registered in `1.0.0_master.yml`. CI's `lint` job runs `node scripts/lint-liquibase.mjs`.
- `companion_flag_log.flag_key` / `companion_flag_trace.flag_key` are `varchar(24)`; `meal_rhythm_drift` is 17 characters — it fits.
- ArchUnit (CI): the rule lives in `companion/flags/service/rule`, constructor DI only, no class-level `@Transactional`, no `@Value`. The directions this rule needs — `companion → fuel` (`ProtocolLapseRule`), `companion → meal` (`LoggingGapRule`), `companion → train` (`ProtocolLapseRule`) — **all already exist**, so no port inversion is required. Do not take that on trust: run the ArchUnit test.
- Backend runs REQUIRE `-Dmezo.test.use-testcontainers=true`, and Maven's OWN exit code — never a pipeline's. "Tests run: 0", or a `-Dtest` filter matching nothing, is a FAILURE to report, not a pass.
- Run everything from this worktree root; never `cd` to the primary repo. Commit subjects carry `(mezo-d58h.7.4)` plus the `Co-Authored-By:` trailer. Regenerate `docs/CODEMAP.md` (`node scripts/gen-codemap.mjs`) in the same change as any new file, and AFTER any docs edit.

---

## File Structure

| File | Responsibility |
|---|---|
| `companion/flags/service/FlagKey.java` (M) | `MEAL_RHYTHM_DRIFT` constant |
| `companion/flags/config/FlagProperties.java` (M) | `MealRhythmDrift` record + `CooldownHours.mealRhythmDrift` + `forFlag` arm |
| `companion/flags/entity/CompanionFlagLogEntity.java` (M) | `@Pattern` mirror |
| `companion/flags/entity/CompanionFlagTraceEntity.java` (M) | `@Pattern` mirror |
| `companion/config/CompanionProperties.java` (M) | `Intervention.flag` `@Pattern` mirror |
| `db/.../202609061600_mezo-d58h.7.4_flag_key_meal_rhythm_drift.sql` (C) + `..._1700_..._trace_...sql` (C) + `1.0.0_master.yml` (M) | the two DB CHECK mirrors |
| `companion/flags/entity/FlagPayloadEnvelope.java` (M) | `MealRhythmDrift` record + factory (**and the 14 existing factories' null lists**) |
| `companion/flags/service/UnavailableReason.java` (M) | three new honesty-gate members |
| `companion/flags/service/rule/MealRhythmDriftRule.java` (C) | the rule |
| `companion/flags/service/FlagEvaluator.java` (M) | one field + one call line |
| `proactive/service/AdvicePriority.java` (M) | one `ORDER` entry |
| `proactive/service/AdviceFactRenderer.java` (M) | one switch arm + one private renderer |
| `application.yml` (M) | threshold block, cooldown, intervention entry |
| `support/populator/MealPopulator.java` (M, test) | bare meal with an explicit `loggedAt` |
| `support/populator/MealSlotTemplatePopulator.java` (M, test) | fixed-anchor rest/training templates |
| `support/populator/TrainPopulator.java` (M, test) | completed instance with an explicit `startedAt` |
| `feature/companion/flags/FlagEvaluatorMealRhythmDriftIT.java` (C, test) | the rule's ITs |
| `feature/companion/flags/MealRhythmDriftRuleSwitchOffIT.java` (C, test) | switch-off proof |
| `FlagPropertiesIT`, `CompanionFlagLogPersistenceIT`, `FlagServiceTraceIT`, `FlagEvaluatorMomentumRecoveryIT`, `AdvicePriorityTest`, `AdviceFactRendererTest`, `InterventionConfigIT` (M, test) | mirrors + enumeration guards |
| `docs/features/companion.md`, `docs/features/proactive.md`, `docs/CODEMAP.md` (M) | docs |

---

### Task 0: branch + issue

- [ ] **Step 1: Claim the issue and cut the branch.**

```bash
bd update mezo-d58h.7.4 --claim && git switch -c feat/proactive-round2-s4-meal-rhythm-drift
```

---

### Task 1: the three test seams

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealPopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealSlotTemplatePopulator.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealRhythmFixtureIT.java` (create)

**Why first:** every IT in Task 5 needs a meal at a *chosen wall-clock time* on a *chosen past day*, a template whose slots are `fixed`-anchored (the shipped `restTemplate` helper anchors breakfast to `wake`, which the drift arm deliberately ignores), and — for the one day-type test — a completed workout instance with a real `startedAt` (`createWorkoutInstance` leaves it null). Without these three the rule is untestable while looking correct.

**Interfaces:**
- Produces: `MealEntity createBareMealAt(UUID owner, LocalDate mealDate, String slot, LocalTime localTime)`
- Produces: `MealSlotTemplateEntity fixedTemplate(UUID owner, String dayType, String breakfast, String lunch, String dinner)`
- Produces: `WorkoutSessionEntity createCompletedInstanceStartedAt(UUID createdBy, WorkoutSessionEntity template, LocalDate date, LocalTime localStart)`

- [ ] **Step 1: Write the failing fixture IT.** Create `backend/src/test/java/io/mrkuhne/mezo/support/populator/MealRhythmFixtureIT.java`:

```java
package io.mrkuhne.mezo.support.populator;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Round 2 S4 (mezo-d58h.7.4): the three fixture seams the meal_rhythm_drift ITs stand on —
 *  a meal at a chosen wall-clock time on a past day, a FIXED-anchor slot template, and a
 *  completed workout instance with a real startedAt (day-type resolution's only input). */
class MealRhythmFixtureIT extends AbstractIntegrationTest {

    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private MealSlotTemplatePopulator mealSlotTemplatePopulator;
    @Autowired private TrainPopulator trainPopulator;

    @Test
    void bareMealAt_carriesTheRequestedWallClockTime() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(3);

        MealEntity meal = mealPopulator.createBareMealAt(owner, day, "dinner", LocalTime.of(21, 15));

        assertThat(meal.getMealDate()).isEqualTo(day);
        assertThat(meal.getLoggedAt().atZone(ZoneId.systemDefault()).toLocalTime())
            .isEqualTo(LocalTime.of(21, 15));
    }

    @Test
    void fixedTemplate_anchorsEverySlotToAClockTime() {
        UUID owner = userPopulator.createUser().getId();

        MealSlotTemplateEntity t =
            mealSlotTemplatePopulator.fixedTemplate(owner, "rest", "07:00", "13:00", "19:00");

        assertThat(t.getSlots()).extracting(MealSlotJson::anchorType).containsOnly("fixed");
        assertThat(t.getSlots()).extracting(MealSlotJson::time)
            .containsExactly("07:00", "13:00", "19:00");
    }

    @Test
    void completedInstanceStartedAt_carriesTheRequestedStart() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity templateDay = trainPopulator.createTemplateDay(owner, meso.getId(), "Push nap");
        LocalDate day = LocalDate.now().minusDays(2);

        WorkoutSessionEntity instance = trainPopulator.createCompletedInstanceStartedAt(
            owner, templateDay, day, LocalTime.of(7, 30));

        assertThat(instance.getStatus()).isEqualTo("completed");
        assertThat(instance.getStartedAt().atZone(ZoneId.systemDefault()).toLocalTime())
            .isEqualTo(LocalTime.of(7, 30));
    }
}
```

- [ ] **Step 2: Run it — it must fail to compile** (the three methods do not exist yet).

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=MealRhythmFixtureIT test
```

Expected: compilation failure naming `createBareMealAt`, `fixedTemplate`, `createCompletedInstanceStartedAt`.

- [ ] **Step 3: Add the `MealPopulator` seam.** Append next to `createBareMealCreatedAt`:

```java
    /** A bare meal on a past day at an explicit WALL-CLOCK time — the meal_rhythm_drift fixture
     *  (mezo-d58h.7.4). The rule reads {@code loggedAt} in the system zone, so the fixture must
     *  mint the instant from a local time, never from a UTC literal. */
    public MealEntity createBareMealAt(UUID owner, LocalDate mealDate, String slot, LocalTime localTime) {
        MealEntity meal = createBareMeal(owner, mealDate, slot);
        meal.setLoggedAt(mealDate.atTime(localTime).atZone(ZoneId.systemDefault()).toInstant());
        return repository.saveAndFlush(meal);
    }
```

Add the imports `java.time.LocalTime` and `java.time.ZoneId` (the file already imports `Instant`, `LocalDate` and `ZoneOffset`).

- [ ] **Step 4: Add the `MealSlotTemplatePopulator` seam.** Append after `restTemplate`:

```java
    /** A 3-slot template whose every slot is FIXED-anchored — the only anchor kind the
     *  meal_rhythm_drift slot-drift arm can read (mezo-d58h.7.4), since relative anchors are
     *  resolved in the frontend only. Budgets sum to 100%. */
    public MealSlotTemplateEntity fixedTemplate(UUID owner, String dayType,
        String breakfast, String lunch, String dinner) {
        return template(owner, dayType, List.of(
            new MealSlotJson("Reggeli", "breakfast", "standard", "fixed", breakfast, null, 30),
            new MealSlotJson("Ebéd", "lunch", "standard", "fixed", lunch, null, 40),
            new MealSlotJson("Vacsora", "dinner", "standard", "fixed", dinner, null, 30)));
    }
```

- [ ] **Step 5: Add the `TrainPopulator` seam.** Append after the two `createWorkoutInstance` overloads:

```java
    /** A COMPLETED instance carrying a real {@code startedAt} — day-type resolution
     *  (mezo-d58h.7.4) has no other input: {@code createWorkoutInstance} leaves it null, and a
     *  training day with no start time is deliberately unresolvable (rest / training_am /
     *  training_pm follows the earliest start, the {@code resolveDayType.ts} convention). */
    public WorkoutSessionEntity createCompletedInstanceStartedAt(UUID createdBy,
        WorkoutSessionEntity template, LocalDate date, LocalTime localStart) {
        WorkoutSessionEntity s = createWorkoutInstance(createdBy, template, date, "completed");
        s.setStartedAt(date.atTime(localStart).atZone(ZoneId.systemDefault()).toInstant());
        return workoutSessionRepository.saveAndFlush(s);
    }
```

Add `java.time.LocalTime` / `java.time.ZoneId` imports if the file lacks them (`grep -n "^import java.time" backend/src/test/java/io/mrkuhne/mezo/support/populator/TrainPopulator.java`).

- [ ] **Step 6: Run the fixture IT — it must pass.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=MealRhythmFixtureIT test
```

Expected: `Tests run: 3, Failures: 0`. "Tests run: 0" is a failure to report, not a pass.

- [ ] **Step 7: Commit.**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/support/populator
git commit -m "test(companion): fixture seams for meal-rhythm drift (mezo-d58h.7.4)"
```

---

### Task 2: the flag key and every mirror, at once

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagKey.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/config/FlagProperties.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagLogEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/CompanionFlagTraceEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/CompanionProperties.java`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609061600_mezo-d58h.7.4_flag_key_meal_rhythm_drift.sql`
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdvicePriority.java`
- Modify: `backend/src/main/resources/application.yml`
- Test: `FlagPropertiesIT`, `CompanionFlagLogPersistenceIT`, `AdvicePriorityTest`, `InterventionConfigIT`

**Interfaces:**
- Produces: `FlagKey.MEAL_RHYTHM_DRIFT == "meal_rhythm_drift"`; `FlagProperties.mealRhythmDrift()` returning `MealRhythmDrift(windowDays, minDaysWithMeals, driftMinutes, minSlotDays, minSameDirectionShare, deadSlotMaxPresence, otherSlotsMinPresence, minSlotPlannedDays)`; `FlagProperties.CooldownHours.mealRhythmDrift()`; `forFlag("meal_rhythm_drift") == 336`.

- [ ] **Step 1: Write the failing tests first.** `AdvicePriorityTest.testOrder_shouldCoverEveryLiveFlagKey` and `InterventionConfigIT.libraryBindsCoversEveryFlagAndKeysAreUnique` both fail by reflection the moment the constant exists without a rank / library entry — no edit needed in either. Add to `CompanionFlagLogPersistenceIT` (follow its existing `rawInsert` cases):

```java
    /** Round 2 S4 (mezo-d58h.7.4): the widened CHECK accepts meal_rhythm_drift. */
    @Test
    void testRawInsert_shouldAcceptMealRhythmDrift() {
        UUID owner = userPopulator.createUser().getId();
        flagLogPopulator.rawInsert(owner, FlagKey.MEAL_RHYTHM_DRIFT, FlagKey.SOURCE_SWEEP);
        assertThat(repository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(owner))
            .extracting(CompanionFlagLogEntity::getFlagKey)
            .contains(FlagKey.MEAL_RHYTHM_DRIFT);
    }
```

and to `FlagPropertiesIT`:

```java
    /** Round 2 S4 (mezo-d58h.7.4): the spec's 14-day cadence is a KEY-level cooldown here (unlike
     *  protocol_lapse's per-item one) — and application.yml's protocol_lapse lesson applies: the
     *  intervention-library entry's own cooldown-hours must match it, or InterventionService's
     *  per-key gate silently overrides the design. */
    @Test
    void binds_the_meal_rhythm_drift_thresholds_and_cooldown() {
        assertThat(properties.mealRhythmDrift().windowDays()).isEqualTo(14);
        assertThat(properties.mealRhythmDrift().minDaysWithMeals()).isEqualTo(10);
        assertThat(properties.mealRhythmDrift().driftMinutes()).isEqualTo(90);
        assertThat(properties.mealRhythmDrift().deadSlotMaxPresence()).isEqualTo(0.30);
        assertThat(properties.mealRhythmDrift().otherSlotsMinPresence()).isEqualTo(0.70);
        assertThat(properties.cooldownHours().mealRhythmDrift()).isEqualTo(336);
        assertThat(properties.cooldownHours().forFlag(FlagKey.MEAL_RHYTHM_DRIFT)).isEqualTo(336);
    }
```

- [ ] **Step 2: Run them — they must fail** (`FlagKey.MEAL_RHYTHM_DRIFT` does not compile yet; that is the expected first failure).

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=FlagPropertiesIT test
```

- [ ] **Step 3: Add the constant.** In `FlagKey.java`, after `PROTOCOL_LAPSE`:

```java
    /** Round 2 S4 (bd mezo-d58h.7.4, spec 2026-09-05 §(13)): the meal-slot plan and the logged
     *  reality have drifted apart — a slot that persistently happens elsewhere, or one that stays
     *  empty while the others are logged. */
    public static final String MEAL_RHYTHM_DRIFT = "meal_rhythm_drift";
```

- [ ] **Step 4: Add the two `@Pattern` mirrors on the entities.** In `CompanionFlagLogEntity.java` and `CompanionFlagTraceEntity.java`, extend the identical regex with `|meal_rhythm_drift`:

```java
    @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy"
        + "|logging_gap|missed_workouts|acute_bad_day|load_fuel_mismatch|rapid_weight_loss"
        + "|joint_overuse|ignored_nudge|late_eating|protocol_lapse|meal_rhythm_drift")
```

- [ ] **Step 5: Add the third `@Pattern` mirror on the config record.** In `CompanionProperties.java` (`Intervention.flag`, ~line 228) append `|meal_rhythm_drift` to the regex, keeping the existing line break.

- [ ] **Step 6: Add the two Liquibase changesets.** Create `backend/src/main/resources/db/changelog/1.0.0/script/202609061600_mezo-d58h.7.4_flag_key_meal_rhythm_drift.sql`:

```sql
-- Proactive coaching round 2, slice S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)): the
-- meal_rhythm_drift detection needs the companion_flag_log.flag_key CHECK widened. Liquibase
-- changesets are immutable — this replaces the constraint created by
-- 202609051600_mezo-d58h.7.1_flag_key_protocol_lapse.sql rather than editing it.
alter table companion_flag_log
    drop constraint ck_companion_flag_log_flag_key;

alter table companion_flag_log
    add constraint ck_companion_flag_log_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift'));
```

and `.../202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift.sql`:

```sql
-- Proactive coaching round 2, slice S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)): the same widening
-- on the coaching-observer trace table (mezo-6269.1), whose CHECK is a separate constraint.
-- Liquibase changesets are immutable — this replaces the constraint created by
-- 202609051700_mezo-d58h.7.1_flag_key_trace_protocol_lapse.sql rather than editing it.
alter table companion_flag_trace
    drop constraint ck_companion_flag_trace_flag_key;

alter table companion_flag_trace
    add constraint ck_companion_flag_trace_flag_key check (flag_key in
        ('sustained_stress', 'sleep_debt', 'momentum_at_risk', 'recovery_needed', 'all_healthy',
         'logging_gap', 'missed_workouts', 'acute_bad_day', 'load_fuel_mismatch',
         'rapid_weight_loss', 'joint_overuse', 'ignored_nudge', 'late_eating', 'protocol_lapse',
         'meal_rhythm_drift'));
```

Register both at the END of `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`:

```yaml
  - changeSet:
      id: "1.0.0:202609061600_mezo-d58h.7.4_flag_key_meal_rhythm_drift"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609061600_mezo-d58h.7.4_flag_key_meal_rhythm_drift.sql
  - changeSet:
      id: "1.0.0:202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609061700_mezo-d58h.7.4_flag_key_trace_meal_rhythm_drift.sql
```

- [ ] **Step 7: Add the config record.** In `FlagProperties.java`, add the component to the record header after `@NotNull @Valid ProtocolLapse protocolLapse,`:

```java
    @NotNull @Valid MealRhythmDrift mealRhythmDrift
```

(the header's last component has no trailing comma — put `mealRhythmDrift` last and add the comma after `protocolLapse`). Then the nested record, after `ProtocolLapse`:

```java
    /** Spec 2026-09-05 §(13): the meal-slot plan and the logged reality have drifted apart. Two
     *  sub-triggers under one key — see {@code MealRhythmDriftRule}. Every ratio is a fraction of
     *  the days a slot was actually PLANNED (day-type-correct template), never of the raw window. */
    public record MealRhythmDrift(
        /** Rolling window (days, ending YESTERDAY — today is still in progress). */
        @Min(7) @Max(60) int windowDays,
        /** Honest small-n gate: fewer days with ANY logged meal than this inside the window ⇒
         *  silence. A logging holiday is not a rhythm change. */
        @Min(3) @Max(60) int minDaysWithMeals,
        /** Slot drift fires only above this median |deviation| from the planned time. */
        @Min(15) @Max(360) int driftMinutes,
        /** Honest small-n gate for the drift arm: days where the slot was both planned (with a
         *  FIXED anchor) and logged. */
        @Min(3) @Max(60) int minSlotDays,
        /** "Persistently": the share of those days that must deviate past {@code driftMinutes}
         *  in the median's own direction. A week of chaos is not a drift. */
        @DecimalMin("0.5") @DecimalMax("1.0") double minSameDirectionShare,
        /** Dead slot: presence at or below this share of the days the slot was planned. */
        @DecimalMin("0.0") @DecimalMax("1.0") double deadSlotMaxPresence,
        /** …while the OTHER tracked slots average at least this presence — the proof that the
         *  user logs, just not this slot. */
        @DecimalMin("0.0") @DecimalMax("1.0") double otherSlotsMinPresence,
        /** Honest small-n gate for the dead-slot arm: days the slot was planned at all. */
        @Min(3) @Max(60) int minSlotPlannedDays
    ) {
    }
```

Add `@Min(1) @Max(8760) int mealRhythmDrift` as the last component of `CooldownHours` (comma after `protocolLapse`), and the `forFlag` arm after `case "protocol_lapse"`:

```java
                case "meal_rhythm_drift" -> mealRhythmDrift;
```

- [ ] **Step 8: Add the `application.yml` defaults.** After the `protocol-lapse:` block under `mezo.companion.flags`:

```yaml
      meal-rhythm-drift:
        # Round 2 S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)). Chrononutrition rolling-distribution
        # math (myCircadianClock): a single day's meal time is noise, only a 10+ day median says
        # anything. The window ends YESTERDAY — today's dinner has not happened at sweep time.
        window-days: 14
        min-days-with-meals: 10
        # Slot drift: the median |actual - planned| must clear an hour and a half, AND at least
        # 70% of the observed days must drift the SAME way. Chaotic days never accumulate.
        drift-minutes: 90
        min-slot-days: 8
        min-same-direction-share: 0.70
        # Dead slot: the slot has meals on <=30% of the days it was planned, while the other
        # tracked slots average >=70% — the user logs, just not this slot.
        dead-slot-max-presence: 0.30
        other-slots-min-presence: 0.70
        min-slot-planned-days: 10
```

In `cooldown-hours:`, after `protocol-lapse: 24`:

```yaml
        # Round 2 S4 (mezo-d58h.7.4): the spec's 14 days. This is an offer to edit a plan, not a
        # health signal — it must speak rarely. MUST match the meal_rhythm_adjust library entry's
        # own cooldown-hours (the protocol_lapse review lesson: InterventionService.deliverForFlag
        # applies the LIBRARY entry's cooldown, so a mismatch silently overrides this value).
        meal-rhythm-drift: 336
```

And the library entry, after `protocol_lapse_resume`:

```yaml
      # Round 2 S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)): a terv és a valóság szétcsúszott. A
      # hangnem SZÁNDÉKOSAN semleges megfigyelés, nem számonkérés: nem az a baj, hogy nem tartod a
      # tervet, hanem az, hogy a terv nem rólad szól. A konkrét slotot, időpontot és arányt a
      # tények blokk mondja meg, nem ez a szöveg. channel: feed — ez sosem érdemel pusht.
      # cooldown-hours 336 == cooldown-hours.meal-rhythm-drift (lásd ott).
      - key: meal_rhythm_adjust
        flag: meal_rhythm_drift
        channel: feed
        text-hu: "Az elmúlt két hét alapján az egyik étkezésed rendszeresen máskor történik, mint ahogy a tervben szerepel — vagy egyszerűen kimarad. Ez nem hiba: valószínűleg a napjaid néznek ki így, és a terv maradt le. Érdemes átírni a slot-tervet arra, ami tényleg megtörténik — onnantól a napi keret is pontosabb lesz."
        cooldown-hours: 336
        quiet-hours-exempt: false
```

- [ ] **Step 9: Add the severity rank.** In `AdvicePriority.ORDER`, after `FlagKey.PROTOCOL_LAPSE`:

```java
        FlagKey.MEAL_RHYTHM_DRIFT,
```

and extend the class javadoc's round-2 paragraph:

```java
 * <p>Round 2 S4 (bd mezo-d58h.7.4): {@link FlagKey#MEAL_RHYTHM_DRIFT} sits immediately after
 * {@code protocol_lapse}, still ahead of the setup checks — it is an offer to edit a plan, not a
 * health signal, so it must never displace a card ranked above it.
```

- [ ] **Step 10: Run the mirror tests — they must pass.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='FlagPropertiesIT,CompanionFlagLogPersistenceIT,AdvicePriorityTest,InterventionConfigIT' test
```

Expected: all green. A Liquibase failure here means the master registration is wrong; a `COMPANION_FLAG_UNKNOWN_KEY` means the `forFlag` arm is missing.

- [ ] **Step 11: Commit.**

```bash
git add backend/src/main backend/src/test
git commit -m "feat(companion): meal_rhythm_drift flag key and every mirror (mezo-d58h.7.4)"
```

---

### Task 3: the payload shape and the honesty-gate reasons

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/entity/FlagPayloadEnvelope.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/UnavailableReason.java`

**Interfaces:**
- Produces: `FlagPayloadEnvelope.mealRhythmDrift(MealRhythmDrift p)` and the nested record below; `UnavailableReason.NO_SLOT_TEMPLATE`, `NOT_ENOUGH_MEAL_DAYS`, `NO_COMPARABLE_SLOTS`.

- [ ] **Step 1: Add the payload record.** In `FlagPayloadEnvelope.java`, add `MealRhythmDrift mealRhythmDrift` as the last component of the outer record header (comma after `ProtocolLapse protocolLapse`), then the nested record after `ProtocolLapse`:

```java
    /** Round 2 S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)). {@code subType} is
     *  {@code "slot_drift"} or {@code "dead_slot"} and decides which half of this record is
     *  populated: the drift half ({@code plannedTime}, {@code observedMedianTime},
     *  {@code medianDeviationMinutes}, {@code sameDirectionShare}, {@code observedDays}) or the
     *  presence half ({@code presenceRatio}, {@code otherSlotsPresenceRatio}). Times are
     *  {@code HH:mm} WALL-CLOCK strings in the system zone — the space the rule compared in, so
     *  the raise is reproducible from the payload alone. {@code medianDeviationMinutes} is SIGNED
     *  (positive = later than planned) and always lands in {@code (-720, 720]} (the circular
     *  difference the rule computes). {@code plannedTime} is null for a dead slot whose anchor is
     *  not {@code fixed} — the backend never resolves relative anchors. */
    public record MealRhythmDrift(
        String subType, String slotKind, String slotLabel,
        int windowDays, int daysWithMeals, int minDaysWithMeals,
        int plannedDays, int observedDays,
        String plannedTime, String observedMedianTime,
        Integer medianDeviationMinutes, Integer driftMinutes, Double sameDirectionShare,
        Double presenceRatio, Double deadSlotMaxPresence,
        Double otherSlotsPresenceRatio, Double otherSlotsMinPresence) {
    }
```

- [ ] **Step 2: Add the factory and widen the fifteen existing ones.** Every existing factory's `new FlagPayloadEnvelope(...)` argument list grows by one trailing `null`. Add:

```java
    public static FlagPayloadEnvelope mealRhythmDrift(MealRhythmDrift p) {
        return new FlagPayloadEnvelope(null, null, null, null, null, null, null, null, null, null,
            null, null, null, null, p);
    }
```

The compiler finds every site that needs the extra `null` — run `./mvnw -f backend/pom.xml -q compile` and fix until clean; do not hand-count.

- [ ] **Step 3: Add the three honesty-gate reasons.** Append to `UnavailableReason`:

```java
    ,
    /** meal_rhythm_drift: the user has no meal_slot_template row at all — there is no plan for
     *  reality to drift away from (that is slot-template setup territory, not this rule's). */
    NO_SLOT_TEMPLATE,
    /** meal_rhythm_drift: fewer days with ANY logged meal inside the window than
     *  {@code min-days-with-meals}. A logging holiday is not a rhythm change. */
    NOT_ENOUGH_MEAL_DAYS,
    /** meal_rhythm_drift: no slot survived the trackability gates (every day unresolvable or
     *  without a matching template, every slot a snack, or an ambiguous duplicate slotKind), so
     *  nothing could be measured — as opposed to measuring and finding no drift. */
    NO_COMPARABLE_SLOTS
```

(written as three plain members appended after `NOT_ENOUGH_PROTOCOL_HISTORY,` — mind the comma on the previously-last member).

- [ ] **Step 4: Compile.**

```bash
./mvnw -f backend/pom.xml -q compile
```

Expected: success.

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags
git commit -m "feat(companion): meal_rhythm_drift payload shape and honesty reasons (mezo-d58h.7.4)"
```

---

### Task 4: the rule

**Files:**
- Create: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/rule/MealRhythmDriftRule.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags/service/FlagEvaluator.java`

**Interfaces:**
- Consumes: `FlagProperties.mealRhythmDrift()` (Task 2), `FlagPayloadEnvelope.mealRhythmDrift(...)` + the three `UnavailableReason` members (Task 3).
- Produces: `MealRhythmDriftRule.evaluate(UUID userId, LocalDate today) → FlagVerdict`, wired into `FlagEvaluator` immediately after `protocolLapseRule` (so `evaluate` now returns **15** verdicts).

- [ ] **Step 1: Write the rule.** Create the file exactly as below.

```java
package io.mrkuhne.mezo.feature.companion.flags.service.rule;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRule;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotTemplateEntity;
import io.mrkuhne.mezo.feature.fuel.repository.MealSlotTemplateRepository;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Round 2 S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)): the meal-slot PLAN and the logged REALITY
 * have drifted apart. Two sub-triggers under one flag key, both measured over a rolling
 * {@code windowDays} window ending YESTERDAY:
 *
 * <ul>
 *   <li><b>slot_drift</b> — a planned slot's actual logged time deviates from its planned time by
 *       a median of more than {@code driftMinutes}, and at least {@code minSameDirectionShare} of
 *       the observed days drift the SAME way.</li>
 *   <li><b>dead_slot</b> — a planned slot has a logged meal on at most
 *       {@code deadSlotMaxPresence} of the days it was planned, while the OTHER tracked slots
 *       average at least {@code otherSlotsMinPresence}. The user logs — just not that slot.</li>
 * </ul>
 *
 * <p>The card phrases both as a neutral observation and offers to adjust the PLAN. This rule never
 * speaks about adherence: a plan that stopped matching a life is the plan's problem.
 *
 * <p><b>Trap 1 — only a {@code fixed} anchor has a time.</b> {@link MealSlotJson} flattens the
 * anchor, and {@code wake}/{@code bed}/{@code training_start}/{@code training_end} slots carry an
 * {@code offsetMin} that is resolved in the FRONTEND only ({@code compileTemplate.ts}), against
 * that day's wake/bed/training blocks. Resolving them here would mean inventing a wake time for
 * every past day, so the drift arm reads {@code fixed}-anchor slots exclusively. The dead-slot arm
 * needs no time and covers every non-snack slot.
 *
 * <p><b>Trap 2 — the day type is derived, never stored.</b> {@code meal_slot_template} has one row
 * per {@code (owner, dayType)}, and the derivation is copied from
 * {@code frontend/src/features/fuel/logic/resolveDayType.ts}: no completed gym instance ⇒
 * {@code rest}; otherwise the EARLIEST instance start before noon ⇒ {@code training_am}, at/after
 * noon ⇒ {@code training_pm}. A training day whose instances ALL lack {@code startedAt} is
 * unresolvable and skipped entirely — never bucketed by guess — and so is a day whose resolved
 * type has no template row. A skipped day enters no numerator and no denominator.
 *
 * <p><b>Trap 3 — clock arithmetic wraps.</b> Deviation is the SIGNED CIRCULAR difference
 * ({@link #circularDeltaMinutes}), always in {@code (-720, 720]}: a 19:00 dinner logged at 00:30
 * is +330 minutes late, not −1110, and a 07:00 breakfast logged at 13:00 is +360, not −1080.
 * {@code LateEatingRule}'s {@code +24-below-noon} shift is deliberately NOT used — that shift
 * exists to put several values on one number line against a single anchor, and applied to a
 * per-slot difference it produces exactly the −18-hour breakfast this helper avoids.
 *
 * <p><b>Ambiguity is silence.</b> {@code snack} is excluded (a template may hold several snack
 * slots, all of which collapse onto the same {@code meal.slot = 'snack'} rows), and any day whose
 * template holds TWO slots of the same non-snack kind contributes nothing for that kind.
 *
 * <p><b>An unlogged day is neither compliant nor violating.</b> Presence ratios count only days
 * that had at least one logged meal of ANY kind — otherwise a logging holiday would read as
 * "your dinner slot died", which is the exact adherence-negative reading the spec forbids.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MealRhythmDriftRule implements FlagRule {

    static final String SUB_TYPE_SLOT_DRIFT = "slot_drift";
    static final String SUB_TYPE_DEAD_SLOT = "dead_slot";

    private static final String SNACK = "snack";
    private static final String ANCHOR_FIXED = "fixed";
    private static final String DAY_TYPE_REST = "rest";
    private static final String DAY_TYPE_TRAINING_AM = "training_am";
    private static final String DAY_TYPE_TRAINING_PM = "training_pm";
    private static final int NOON_MINUTES = 720;
    private static final int DAY_MINUTES = 1440;

    private final MealSlotTemplateRepository mealSlotTemplateRepository;
    private final MealRepository mealRepository;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final FlagProperties properties;

    @Override
    public FlagVerdict evaluate(UUID userId, LocalDate today) {
        FlagProperties.MealRhythmDrift cfg = properties.mealRhythmDrift();

        Map<String, List<MealSlotJson>> templates = new HashMap<>();
        for (MealSlotTemplateEntity t : mealSlotTemplateRepository.findAllByCreatedByAndDeletedFalse(userId)) {
            if (t.getSlots() != null && !t.getSlots().isEmpty()) {
                templates.put(t.getDayType(), t.getSlots());
            }
        }
        if (templates.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT, UnavailableReason.NO_SLOT_TEMPLATE);
        }

        // The window ends YESTERDAY: today's dinner has not happened at sweep time (Trap 3 of
        // ProtocolLapseRule, same reasoning).
        LocalDate to = today.minusDays(1);
        LocalDate from = to.minusDays(cfg.windowDays() - 1L);

        Map<LocalDate, Map<String, LocalTime>> earliestByDayAndKind = new HashMap<>();
        for (MealEntity meal : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(userId, from, to)) {
            if (meal.getLoggedAt() == null || meal.getSlot() == null) {
                continue;
            }
            LocalTime at = meal.getLoggedAt().atZone(ZoneId.systemDefault()).toLocalTime();
            Map<String, LocalTime> byKind =
                earliestByDayAndKind.computeIfAbsent(meal.getMealDate(), d -> new HashMap<>());
            // A plan slot names ONE eating event: the earliest row of that kind is the one the
            // plan is about (a second dinner is a second helping, not a second dinner slot).
            byKind.merge(meal.getSlot(), at, (a, b) -> a.isBefore(b) ? a : b);
        }
        if (earliestByDayAndKind.size() < cfg.minDaysWithMeals()) {
            return FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT,
                UnavailableReason.NOT_ENOUGH_MEAL_DAYS);
        }

        Map<LocalDate, String> dayTypes = resolveDayTypes(userId, from, to);

        Map<String, SlotStats> statsByKind = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            Map<String, LocalTime> logged = earliestByDayAndKind.get(day);
            if (logged == null) {
                continue; // an unlogged day is neither compliant nor violating — it is skipped
            }
            String dayType = dayTypes.get(day);
            if (dayType == null) {
                continue; // unresolvable training day (Trap 2)
            }
            List<MealSlotJson> slots = templates.get(dayType);
            if (slots == null) {
                continue; // no template for this day type — nothing was planned to drift from
            }
            for (MealSlotJson slot : slots) {
                String kind = slot.slotKind();
                if (kind == null || SNACK.equals(kind) || duplicateKind(slots, kind)) {
                    continue; // ambiguity is silence
                }
                SlotStats stats = statsByKind.computeIfAbsent(kind, k -> new SlotStats());
                stats.label = slot.label() == null ? kind : slot.label();
                stats.plannedDays++;
                LocalTime actual = logged.get(kind);
                if (actual != null) {
                    stats.presentDays++;
                }
                LocalTime planned = plannedTime(slot);
                if (planned != null && actual != null) {
                    stats.plannedTime = planned;
                    stats.deviations.add(circularDeltaMinutes(
                        actual.getHour() * 60 + actual.getMinute(),
                        planned.getHour() * 60 + planned.getMinute()));
                    stats.actualMinutes.add(actual.getHour() * 60 + actual.getMinute());
                }
            }
        }
        if (statsByKind.isEmpty()) {
            return FlagVerdict.unavailable(FlagKey.MEAL_RHYTHM_DRIFT,
                UnavailableReason.NO_COMPARABLE_SLOTS);
        }

        int daysWithMeals = earliestByDayAndKind.size();
        FlagPayloadEnvelope.MealRhythmDrift dead = deadSlot(cfg, statsByKind, daysWithMeals);
        if (dead != null) {
            return FlagVerdict.raised(FlagKey.MEAL_RHYTHM_DRIFT,
                FlagPayloadEnvelope.mealRhythmDrift(dead));
        }
        FlagPayloadEnvelope.MealRhythmDrift drift = slotDrift(cfg, statsByKind, daysWithMeals);
        if (drift != null) {
            return FlagVerdict.raised(FlagKey.MEAL_RHYTHM_DRIFT,
                FlagPayloadEnvelope.mealRhythmDrift(drift));
        }

        // Genuinely judged and found nothing: the largest median deviation seen is the honest
        // "how close did it get" number, 0 when no slot had enough paired days to measure.
        double largestMedian = statsByKind.values().stream()
            .filter(s -> s.deviations.size() >= cfg.minSlotDays())
            .mapToDouble(s -> Math.abs(median(s.deviations)))
            .max().orElse(0.0);
        return FlagVerdict.clear(FlagKey.MEAL_RHYTHM_DRIFT, new FlagVerdict.ClearEvidence(
            "drift_minutes", largestMedian, (double) cfg.driftMinutes(), null));
    }

    /** Dead slot: the emptiest qualifying slot, provided the OTHER tracked slots really are being
     *  logged. Checked before drift — an empty slot is a bigger plan mismatch than a late one. */
    private FlagPayloadEnvelope.MealRhythmDrift deadSlot(
        FlagProperties.MealRhythmDrift cfg, Map<String, SlotStats> statsByKind, int daysWithMeals) {
        String worstKind = null;
        double worstRatio = Double.MAX_VALUE;
        double othersRatio = 0.0;
        for (Map.Entry<String, SlotStats> e : statsByKind.entrySet()) {
            SlotStats s = e.getValue();
            if (s.plannedDays < cfg.minSlotPlannedDays()) {
                continue;
            }
            double ratio = (double) s.presentDays / s.plannedDays;
            if (ratio > cfg.deadSlotMaxPresence()) {
                continue;
            }
            List<Double> others = new ArrayList<>();
            for (Map.Entry<String, SlotStats> other : statsByKind.entrySet()) {
                SlotStats o = other.getValue();
                if (!other.getKey().equals(e.getKey()) && o.plannedDays >= cfg.minSlotPlannedDays()) {
                    others.add((double) o.presentDays / o.plannedDays);
                }
            }
            if (others.isEmpty()) {
                continue; // nothing to compare against — "empty" and "not logging" are the same claim
            }
            double othersMean = others.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
            if (othersMean < cfg.otherSlotsMinPresence()) {
                continue;
            }
            if (ratio < worstRatio) {
                worstKind = e.getKey();
                worstRatio = ratio;
                othersRatio = othersMean;
            }
        }
        if (worstKind == null) {
            return null;
        }
        SlotStats s = statsByKind.get(worstKind);
        return new FlagPayloadEnvelope.MealRhythmDrift(
            SUB_TYPE_DEAD_SLOT, worstKind, s.label,
            cfg.windowDays(), daysWithMeals, cfg.minDaysWithMeals(),
            s.plannedDays, s.presentDays,
            s.plannedTime == null ? null : s.plannedTime.toString(), null,
            null, null, null,
            worstRatio, cfg.deadSlotMaxPresence(),
            othersRatio, cfg.otherSlotsMinPresence());
    }

    /** Slot drift: the slot whose median deviation is largest, provided it also drifts
     *  CONSISTENTLY (a week of chaos is not a drift). */
    private FlagPayloadEnvelope.MealRhythmDrift slotDrift(
        FlagProperties.MealRhythmDrift cfg, Map<String, SlotStats> statsByKind, int daysWithMeals) {
        String worstKind = null;
        double worstMedian = 0.0;
        double worstShare = 0.0;
        for (Map.Entry<String, SlotStats> e : statsByKind.entrySet()) {
            SlotStats s = e.getValue();
            if (s.deviations.size() < cfg.minSlotDays() || s.plannedTime == null) {
                continue;
            }
            double med = median(s.deviations);
            if (Math.abs(med) <= cfg.driftMinutes()) {
                continue;
            }
            long sameDirection = s.deviations.stream()
                .filter(d -> Math.abs(d) > cfg.driftMinutes() && Math.signum(d) == Math.signum(med))
                .count();
            double share = (double) sameDirection / s.deviations.size();
            if (share < cfg.minSameDirectionShare()) {
                continue;
            }
            if (Math.abs(med) > Math.abs(worstMedian)) {
                worstKind = e.getKey();
                worstMedian = med;
                worstShare = share;
            }
        }
        if (worstKind == null) {
            return null;
        }
        SlotStats s = statsByKind.get(worstKind);
        int medianActual = (int) Math.round(median(s.actualMinutes.stream()
            .map(Integer::doubleValue).toList()));
        return new FlagPayloadEnvelope.MealRhythmDrift(
            SUB_TYPE_SLOT_DRIFT, worstKind, s.label,
            cfg.windowDays(), daysWithMeals, cfg.minDaysWithMeals(),
            s.plannedDays, s.deviations.size(),
            s.plannedTime.toString(), clock(medianActual),
            (int) Math.round(worstMedian), cfg.driftMinutes(), worstShare,
            null, null, null, null);
    }

    /** {@code resolveDayType.ts}, ported (Trap 2): no completed instance ⇒ rest; otherwise the
     *  EARLIEST start before noon ⇒ training_am, at/after noon ⇒ training_pm. A training day with
     *  no start time at all is absent from the map, i.e. unresolvable and skipped. */
    private Map<LocalDate, String> resolveDayTypes(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Integer> earliestStart = new HashMap<>();
        Set<LocalDate> trainingDays = new HashSet<>();
        for (WorkoutSessionEntity s : workoutSessionRepository.findDoneInstancesBetween(userId, from, to)) {
            if (s.getDate() == null) {
                continue;
            }
            trainingDays.add(s.getDate());
            if (s.getStartedAt() != null) {
                LocalTime start = s.getStartedAt().atZone(ZoneId.systemDefault()).toLocalTime();
                earliestStart.merge(s.getDate(), start.getHour() * 60 + start.getMinute(), Math::min);
            }
        }
        Map<LocalDate, String> dayTypes = new HashMap<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            if (!trainingDays.contains(d)) {
                dayTypes.put(d, DAY_TYPE_REST);
                continue;
            }
            Integer earliest = earliestStart.get(d);
            if (earliest == null) {
                continue; // trained, but WHEN is unknown — never guess a type
            }
            dayTypes.put(d, earliest < NOON_MINUTES ? DAY_TYPE_TRAINING_AM : DAY_TYPE_TRAINING_PM);
        }
        return dayTypes;
    }

    /** Two slots of the same non-snack kind in one template make "which one was this meal" —
     *  and therefore both arms — unanswerable for that kind on that day. */
    private static boolean duplicateKind(List<MealSlotJson> slots, String kind) {
        return slots.stream().filter(s -> kind.equals(s.slotKind())).count() > 1;
    }

    /** Only a {@code fixed} anchor carries a wall-clock time (Trap 1). */
    private static LocalTime plannedTime(MealSlotJson slot) {
        if (!ANCHOR_FIXED.equals(slot.anchorType()) || slot.time() == null) {
            return null;
        }
        try {
            return LocalTime.parse(slot.time());
        } catch (java.time.format.DateTimeParseException e) {
            return null; // a malformed stored time is missing data, never a drift
        }
    }

    /** Signed circular difference in {@code (-720, 720]} (Trap 3): positive = later than planned. */
    static int circularDeltaMinutes(int actualMinutes, int plannedMinutes) {
        int delta = Math.floorMod(actualMinutes - plannedMinutes, DAY_MINUTES);
        return delta > NOON_MINUTES ? delta - DAY_MINUTES : delta;
    }

    /** Plain median (mean of the two middle values on an even count) — the chrononutrition
     *  quantile convention: a single outlier day must not move the verdict. */
    private static double median(List<? extends Number> values) {
        List<Double> sorted = values.stream().map(Number::doubleValue)
            .sorted(Comparator.naturalOrder()).toList();
        int n = sorted.size();
        if (n == 0) {
            return 0.0;
        }
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private static String clock(int minuteOfDay) {
        int m = Math.floorMod(minuteOfDay, DAY_MINUTES);
        return "%02d:%02d".formatted(m / 60, m % 60);
    }

    /** Per-slotKind accumulator over the window — mutable on purpose, it never leaves this class. */
    private static final class SlotStats {
        private String label;
        private LocalTime plannedTime;
        private int plannedDays;
        private int presentDays;
        private final List<Integer> deviations = new ArrayList<>();
        private final List<Integer> actualMinutes = new ArrayList<>();
    }
}
```

- [ ] **Step 2: Wire it into the evaluator.** In `FlagEvaluator.java`: add the import, the field after `protocolLapseRule`, and the call line after `verdicts.add(protocolLapseRule.evaluate(userId, today));`:

```java
    private final MealRhythmDriftRule mealRhythmDriftRule;
```

```java
        verdicts.add(mealRhythmDriftRule.evaluate(userId, today));
```

Update the `evaluate` javadoc: "15 entries, one per rule, in AdvicePriority order."

- [ ] **Step 3: Compile.**

```bash
./mvnw -f backend/pom.xml -q compile
```

Expected: success.

- [ ] **Step 4: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/flags
git commit -m "feat(companion): meal_rhythm_drift detection (mezo-d58h.7.4)"
```

---

### Task 5: the rule's ITs

**Files:**
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorMealRhythmDriftIT.java`
- Create: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/MealRhythmDriftRuleSwitchOffIT.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagServiceTraceIT.java` (14 → 15)
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/companion/flags/FlagEvaluatorMomentumRecoveryIT.java` (14 → 15)

**Interfaces:**
- Consumes: `MealRhythmDriftRule` (Task 4), the three populator seams (Task 1).

- [ ] **Step 1: Write the IT.** Create `FlagEvaluatorMealRhythmDriftIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.fuel.entity.MealSlotJson;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MealSlotTemplatePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S4 (mezo-d58h.7.4, spec 2026-09-05 §(13)): the meal-slot plan vs. the logged reality —
 * see {@code MealRhythmDriftRule}'s javadoc for the three load-bearing traps this file proves
 * (fixed-anchor-only drift, derived day type, circular clock arithmetic) plus the honesty gates.
 */
class FlagEvaluatorMealRhythmDriftIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private MealSlotTemplatePopulator mealSlotTemplatePopulator;
    @Autowired private TrainPopulator trainPopulator;

    private static final LocalDate TODAY = LocalDate.now();
    /** The window is [TODAY-14, TODAY-1]: it ends YESTERDAY, today is still in progress. */
    private static final int WINDOW = 14;

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    private Optional<FlagPayloadEnvelope.MealRhythmDrift> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.MEAL_RHYTHM_DRIFT.equals(v.flagKey()))
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(v -> v.payload().mealRhythmDrift())
            .findFirst();
    }

    /** An owner with a 07:00/13:00/19:00 FIXED rest-day template and no workouts at all — every
     *  window day therefore resolves to 'rest' with a known plan. */
    private UUID plannedOwner() {
        UUID owner = userPopulator.createUser().getId();
        mealSlotTemplatePopulator.fixedTemplate(owner, "rest", "07:00", "13:00", "19:00");
        return owner;
    }

    /** Logs breakfast/lunch/dinner on each of the last {@code days} closed days, dinner at
     *  {@code dinnerTime}, everything else at plan. */
    private void logDays(UUID owner, int days, LocalTime dinnerTime) {
        for (int i = 1; i <= days; i++) {
            LocalDate d = TODAY.minusDays(i);
            mealPopulator.createBareMealAt(owner, d, "breakfast", LocalTime.of(7, 5));
            mealPopulator.createBareMealAt(owner, d, "lunch", LocalTime.of(13, 10));
            if (dinnerTime != null) {
                mealPopulator.createBareMealAt(owner, d, "dinner", dinnerTime);
            }
        }
    }

    /** The detection, arm 1: dinner is planned for 19:00 but actually lives around 21:00 on every
     *  day of the window — a two-hour median drift, consistently late. */
    @Test
    void raises_slot_drift_when_a_slot_persistently_happens_elsewhere() {
        UUID owner = plannedOwner();
        logDays(owner, WINDOW, LocalTime.of(21, 0));

        assertThat(keys(owner)).contains(FlagKey.MEAL_RHYTHM_DRIFT);
        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.subType()).isEqualTo("slot_drift");
            assertThat(p.slotKind()).isEqualTo("dinner");
            assertThat(p.plannedTime()).isEqualTo("19:00");
            assertThat(p.observedMedianTime()).isEqualTo("21:00");
            assertThat(p.medianDeviationMinutes()).isEqualTo(120);
            assertThat(p.sameDirectionShare()).isEqualTo(1.0);
        });
    }

    /** Trap 3: a 19:00-planned dinner logged at 00:30 is +330 minutes LATE, never −1110. Without
     *  the circular difference the median flips sign and the same-direction share collapses. */
    @Test
    void treats_a_past_midnight_meal_as_late_not_as_absurdly_early() {
        UUID owner = plannedOwner();
        logDays(owner, WINDOW, LocalTime.of(0, 30));

        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.subType()).isEqualTo("slot_drift");
            assertThat(p.medianDeviationMinutes()).isEqualTo(330);
        });
    }

    /** The detection, arm 2: the dinner slot is planned every day and logged on none of them,
     *  while breakfast and lunch are logged every day. */
    @Test
    void raises_dead_slot_when_one_planned_slot_stays_empty_while_the_others_are_logged() {
        UUID owner = plannedOwner();
        logDays(owner, WINDOW, null);

        assertThat(keys(owner)).contains(FlagKey.MEAL_RHYTHM_DRIFT);
        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.subType()).isEqualTo("dead_slot");
            assertThat(p.slotKind()).isEqualTo("dinner");
            assertThat(p.presenceRatio()).isEqualTo(0.0);
            assertThat(p.otherSlotsPresenceRatio()).isEqualTo(1.0);
        });
    }

    /** A plan followed to the minute says nothing — and says it as CLEAR, with the observed
     *  median deviation frozen, not as an honesty gate. */
    @Test
    void is_clear_when_the_plan_matches_reality() {
        UUID owner = plannedOwner();
        logDays(owner, WINDOW, LocalTime.of(19, 10));

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MEAL_RHYTHM_DRIFT);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("drift_minutes");
        assertThat(verdict.clear().threshold()).isEqualTo(90.0);
    }

    /** A single wildly late dinner is noise: 13 on-plan days and one 23:30 outlier leave the
     *  MEDIAN untouched. This is the chrononutrition decision (single-day signals are noise). */
    @Test
    void stays_silent_when_only_one_day_is_off() {
        UUID owner = plannedOwner();
        logDays(owner, WINDOW, LocalTime.of(19, 10));
        mealPopulator.createBareMealAt(owner, TODAY.minusDays(1), "dinner", LocalTime.of(23, 30));

        assertThat(keys(owner)).doesNotContain(FlagKey.MEAL_RHYTHM_DRIFT);
    }

    /** Chaos is not drift: the dinner alternates 2h early / 2h late, so the median is near zero
     *  and the same-direction share never reaches the threshold. */
    @Test
    void stays_silent_when_the_deviation_has_no_consistent_direction() {
        UUID owner = plannedOwner();
        for (int i = 1; i <= WINDOW; i++) {
            LocalDate d = TODAY.minusDays(i);
            mealPopulator.createBareMealAt(owner, d, "breakfast", LocalTime.of(7, 5));
            mealPopulator.createBareMealAt(owner, d, "lunch", LocalTime.of(13, 10));
            mealPopulator.createBareMealAt(owner, d, "dinner",
                i % 2 == 0 ? LocalTime.of(17, 0) : LocalTime.of(21, 0));
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.MEAL_RHYTHM_DRIFT);
    }

    /** Honesty gate: nine logged days is below min-days-with-meals (10), however extreme the
     *  drift on them — too little data means silence, not a smaller claim. */
    @Test
    void stays_silent_when_too_few_days_carry_meals() {
        UUID owner = plannedOwner();
        logDays(owner, 9, LocalTime.of(22, 0));

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MEAL_RHYTHM_DRIFT);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.unavailableReason()).isEqualTo(UnavailableReason.NOT_ENOUGH_MEAL_DAYS);
    }

    /** Honesty gate: no template at all means there is no plan for reality to drift away from —
     *  that is slot-template setup territory, not this rule's. */
    @Test
    void stays_silent_when_the_user_has_no_slot_template() {
        UUID owner = userPopulator.createUser().getId();
        logDays(owner, WINDOW, LocalTime.of(22, 0));

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MEAL_RHYTHM_DRIFT);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.unavailableReason()).isEqualTo(UnavailableReason.NO_SLOT_TEMPLATE);
    }

    /** Trap 1: a relative-anchor slot has no backend-resolvable time, so the drift arm must not
     *  measure it. The dinner here is anchored to bed-time and logged four hours off plan-ish —
     *  there is simply no plan time to compare against, and the dead-slot arm cannot fire either
     *  (the slot IS logged every day). */
    @Test
    void ignores_slots_whose_anchor_is_not_fixed() {
        UUID owner = userPopulator.createUser().getId();
        mealSlotTemplatePopulator.template(owner, "rest", List.of(
            new MealSlotJson("Reggeli", "breakfast", "standard", "fixed", "07:00", null, 30),
            new MealSlotJson("Ebéd", "lunch", "standard", "fixed", "13:00", null, 40),
            new MealSlotJson("Vacsora", "dinner", "standard", "bed", null, -120, 30)));
        logDays(owner, WINDOW, LocalTime.of(23, 30));

        assertThat(keys(owner)).doesNotContain(FlagKey.MEAL_RHYTHM_DRIFT);
    }

    /** Ambiguity is silence: two dinner slots in one template make "which dinner was this"
     *  unanswerable, so the kind contributes nothing — even though one of them is 2h off. */
    @Test
    void ignores_a_slot_kind_that_appears_twice_in_the_template() {
        UUID owner = userPopulator.createUser().getId();
        mealSlotTemplatePopulator.template(owner, "rest", List.of(
            new MealSlotJson("Reggeli", "breakfast", "standard", "fixed", "07:00", null, 30),
            new MealSlotJson("Ebéd", "lunch", "standard", "fixed", "13:00", null, 30),
            new MealSlotJson("Vacsora", "dinner", "standard", "fixed", "19:00", null, 20),
            new MealSlotJson("Második vacsora", "dinner", "standard", "fixed", "21:00", null, 20)));
        logDays(owner, WINDOW, LocalTime.of(21, 0));

        assertThat(keys(owner)).doesNotContain(FlagKey.MEAL_RHYTHM_DRIFT);
    }

    /** Trap 2: a completed 07:30 workout makes the day 'training_am', so the TRAINING template's
     *  17:00 dinner is the plan — and a 21:00 dinner drifts against THAT, not against the
     *  rest-day 19:00. Proves the day-type derivation actually selects the template. */
    @Test
    void measures_a_training_day_against_its_own_day_type_template() {
        UUID owner = userPopulator.createUser().getId();
        mealSlotTemplatePopulator.fixedTemplate(owner, "training_am", "07:00", "13:00", "17:00");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity templateDay = trainPopulator.createTemplateDay(owner, meso.getId(), "Push nap");
        for (int i = 1; i <= WINDOW; i++) {
            trainPopulator.createCompletedInstanceStartedAt(
                owner, templateDay, TODAY.minusDays(i), LocalTime.of(7, 30));
        }
        logDays(owner, WINDOW, LocalTime.of(21, 0));

        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.subType()).isEqualTo("slot_drift");
            assertThat(p.plannedTime()).isEqualTo("17:00");
            assertThat(p.medianDeviationMinutes()).isEqualTo(240);
        });
    }

    /** The window ends YESTERDAY: a drift that exists only in TODAY's rows never enters the scan,
     *  so the rule cannot speak about a day that is still in progress. */
    @Test
    void never_looks_at_today() {
        UUID owner = plannedOwner();
        logDays(owner, WINDOW, LocalTime.of(19, 10));
        mealPopulator.createBareMealAt(owner, TODAY, "dinner", LocalTime.of(23, 45));

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MEAL_RHYTHM_DRIFT);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
    }
}
```

- [ ] **Step 2: Write the switch-off IT.** Create `MealRhythmDriftRuleSwitchOffIT.java`:

```java
package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.rule.MealRhythmDriftRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/** Round 2 S4 (mezo-d58h.7.4): companion switch off ⇒ no meal-rhythm-drift rule bean, so the
 *  whole detection is genuinely absent rather than silently evaluating. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class MealRhythmDriftRuleSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;

    @Test
    void testContext_shouldHaveNoRuleBean_whenCompanionSwitchOff() {
        assertThat(context.getBeanProvider(MealRhythmDriftRule.class).getIfAvailable()).isNull();
    }
}
```

- [ ] **Step 3: Update the two enumeration guards.** `FlagServiceTraceIT.java:43` (`.hasSize(14)`) and `FlagEvaluatorMomentumRecoveryIT.java:368` (`assertThat(evaluator.evaluate(owner)).hasSize(14)`) both become `15` — the evaluator now returns one verdict per rule and there are fifteen rules.

- [ ] **Step 4: Run the ITs.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='FlagEvaluatorMealRhythmDriftIT,MealRhythmDriftRuleSwitchOffIT,FlagServiceTraceIT,FlagEvaluatorMomentumRecoveryIT' test
```

Expected: all green. If a drift test raises `dead_slot` instead of `slot_drift`, the dinner rows are missing from the fixture (`logDays(..., null)` is the dead-slot fixture only).

- [ ] **Step 5: Commit.**

```bash
git add backend/src/test
git commit -m "test(companion): meal_rhythm_drift rule ITs and switch-off proof (mezo-d58h.7.4)"
```

---

### Task 6: the card's facts

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRenderer.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/service/AdviceFactRendererTest.java`

**Interfaces:**
- Consumes: `FlagPayloadEnvelope.MealRhythmDrift` (Task 3).

- [ ] **Step 1: Write the failing renderer tests.** Append to `AdviceFactRendererTest`:

```java
    /** Round 2 S4 (mezo-d58h.7.4): the drift facts name the slot, both times and the direction —
     *  the copy is a neutral observation, so the numbers must carry the whole claim. */
    @Test
    void rendersMealRhythmDriftFacts() {
        List<String> facts = AdviceFactRenderer.render(FlagKey.MEAL_RHYTHM_DRIFT,
            FlagPayloadEnvelope.mealRhythmDrift(new FlagPayloadEnvelope.MealRhythmDrift(
                "slot_drift", "dinner", "Vacsora", 14, 13, 10, 13, 12,
                "19:00", "21:00", 120, 90, 0.92, null, null, null, null)));

        assertThat(facts).anySatisfy(f -> assertThat(f).contains("Vacsora"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("19:00").contains("21:00"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("120"));
    }

    /** The dead-slot arm renders the two presence ratios instead of the two clock times. */
    @Test
    void rendersMealRhythmDeadSlotFacts() {
        List<String> facts = AdviceFactRenderer.render(FlagKey.MEAL_RHYTHM_DRIFT,
            FlagPayloadEnvelope.mealRhythmDrift(new FlagPayloadEnvelope.MealRhythmDrift(
                "dead_slot", "dinner", "Vacsora", 14, 13, 10, 13, 1,
                "19:00", null, null, null, null, 0.077, 0.30, 0.95, 0.70)));

        assertThat(facts).anySatisfy(f -> assertThat(f).contains("Vacsora"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("8%"));
        assertThat(facts).anySatisfy(f -> assertThat(f).contains("95%"));
    }

    /** Null payload never throws — the renderer is the last thing standing between a malformed
     *  log row and the delivery listener's catch. */
    @Test
    void rendersNothingForAnEmptyMealRhythmPayload() {
        assertThat(AdviceFactRenderer.render(FlagKey.MEAL_RHYTHM_DRIFT,
            FlagPayloadEnvelope.mealRhythmDrift(null))).isEmpty();
    }
```

- [ ] **Step 2: Run them — they must fail** (`render` returns `List.of()` for the unknown key, so the `anySatisfy` assertions fail).

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=AdviceFactRendererTest test
```

- [ ] **Step 3: Add the switch arm and the renderer.** In `AdviceFactRenderer.java`, after the `PROTOCOL_LAPSE` arm:

```java
            case FlagKey.MEAL_RHYTHM_DRIFT -> mealRhythmDrift(payload.mealRhythmDrift());
```

and the private renderer next to `protocolLapse`:

```java
    /** Round 2 S4 (mezo-d58h.7.4): a NEUTRAL observation — the facts state what the plan says,
     *  what actually happened and over how many days, and never use an adherence verb. The two
     *  sub-types render different halves of the payload (see the envelope record's javadoc). */
    private static List<String> mealRhythmDrift(FlagPayloadEnvelope.MealRhythmDrift p) {
        if (p == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("Étkezési slot: %s (%s)".formatted(
            Objects.requireNonNullElse(p.slotLabel(), p.slotKind()), p.slotKind()));
        if (MEAL_RHYTHM_DEAD_SLOT.equals(p.subType())) {
            facts.add("A %d napból, amikorra be volt tervezve, %d napon volt rögzítve étkezés (%s%%)"
                .formatted(p.plannedDays(), p.observedDays(), pct(p.presenceRatio())));
            facts.add("A többi slot ugyanebben az ablakban átlagosan %s%%-on áll (küszöb: %s%%)"
                .formatted(pct(p.otherSlotsPresenceRatio()), pct(p.otherSlotsMinPresence())));
        } else {
            facts.add("Terv szerint %s, a valóságban jellemzően %s (%d perc %s)".formatted(
                p.plannedTime(), p.observedMedianTime(),
                Math.abs(p.medianDeviationMinutes() == null ? 0 : p.medianDeviationMinutes()),
                p.medianDeviationMinutes() != null && p.medianDeviationMinutes() < 0
                    ? "korábban" : "később"));
            facts.add("%d megfigyelt napból ennyi mozdult ugyanabba az irányba: %s%% (küszöb: %d perc)"
                .formatted(p.observedDays(), pct(p.sameDirectionShare()),
                    p.driftMinutes() == null ? 0 : p.driftMinutes()));
        }
        facts.add("Ablak: %d nap, ebből %d napon volt rögzített étkezés (minimum %d)"
            .formatted(p.windowDays(), p.daysWithMeals(), p.minDaysWithMeals()));
        return List.copyOf(facts);
    }

    /** A 0.0-1.0 arány egész százalékként — null-biztos, mert a fél-kitöltött payload a
     *  sub-type szerinti normális állapot, nem hiba. */
    private static String pct(Double ratio) {
        return ratio == null ? "-" : String.format(HU, "%.0f", ratio * 100);
    }
```

Add the constant next to the class's other string constants:

```java
    private static final String MEAL_RHYTHM_DEAD_SLOT = "dead_slot";
```

(`ArrayList`, `Objects` and `HU` are already imported/present — the `protocolLapse` renderer uses all three.)

- [ ] **Step 4: Run the renderer tests — they must pass.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=AdviceFactRendererTest test
```

- [ ] **Step 5: Commit.**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/proactive backend/src/test/java/io/mrkuhne/mezo/feature/proactive
git commit -m "feat(proactive): meal_rhythm_drift facts for the advice card (mezo-d58h.7.4)"
```

---

### Task 7: end-to-end delivery proof

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionServiceIT.java`

**Interfaces:**
- Consumes: everything above; asserts a real `companion_message` row through `InterventionService.deliverForFlag`.

- [ ] **Step 1: Write the failing test.** Append to `InterventionServiceIT`:

```java
    /** Round 2 S4 (mezo-d58h.7.4): the flag really becomes a card through the ordinary library
     *  path, and the card's facts carry the frozen payload's slot label — the whole point of
     *  freezing it (AdviceFactRenderer has no repositories). */
    @Test
    void mealRhythmDriftRaiseBecomesACardWithItsSlotInTheFacts() {
        UUID owner = ownerId();
        flagLogPopulator.raise(owner, FlagKey.MEAL_RHYTHM_DRIFT, FlagKey.SOURCE_SWEEP,
            FlagPayloadEnvelope.mealRhythmDrift(new FlagPayloadEnvelope.MealRhythmDrift(
                "slot_drift", "dinner", "Vacsora", 14, 13, 10, 13, 12,
                "19:00", "21:00", 120, 90, 0.92, null, null, null, null)));

        Optional<CompanionMessageEntity> card =
            interventionService.deliverForFlag(owner, FlagKey.MEAL_RHYTHM_DRIFT);

        assertThat(card).isPresent();
        assertThat(card.get().getContent().interventionKey()).isEqualTo("meal_rhythm_adjust");
        assertThat(card.get().getContent().adviceKey()).isEqualTo(FlagKey.MEAL_RHYTHM_DRIFT);
        assertThat(card.get().getContent().facts()).anySatisfy(f -> assertThat(f).contains("Vacsora"));
    }
```

- [ ] **Step 2: Run it.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest=InterventionServiceIT test
```

Expected: green. An empty `card` means the library entry's `flag:` value or its `@Pattern` mirror is wrong.

- [ ] **Step 3: Commit.**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/proactive/InterventionServiceIT.java
git commit -m "test(proactive): meal_rhythm_drift delivers a real advice card (mezo-d58h.7.4)"
```

---

### Task 8: architecture gate + focused suite

**Files:** none (verification only).

- [ ] **Step 1: Run the ArchUnit suite** — the new rule's package placement, constructor DI and cross-feature read directions.

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true -Dtest='*ArchUnit*,*Architecture*' test
```

If the filter matches nothing, find the real class first (`ls backend/src/test/java/io/mrkuhne/mezo/architecture 2>/dev/null || grep -rl 'ArchTest\|ArchRuleDefinition' backend/src/test --include=*.java`) and run that class by name. A filter matching nothing is a FAILURE to report, not a pass.

- [ ] **Step 2: Run the whole companion-flags + proactive focused set.**

```bash
./mvnw -f backend/pom.xml -Dmezo.test.use-testcontainers=true \
  -Dtest='io.mrkuhne.mezo.feature.companion.flags.*IT,io.mrkuhne.mezo.feature.proactive.*IT,AdvicePriorityTest,AdviceFactRendererTest' test
```

Expected: green, with a non-zero "Tests run". This is the local gate; the authoritative full suite is CI on the self-PR.

- [ ] **Step 3: Run the Liquibase lint.**

```bash
node scripts/lint-liquibase.mjs
```

---

### Task 9: docs, codemap, PR

**Files:**
- Modify: `docs/features/companion.md`
- Modify: `docs/features/proactive.md`
- Modify: `docs/CODEMAP.md` (generated)

- [ ] **Step 1: Extend the flag table in `docs/features/companion.md`.** Add a row directly after the `protocol_lapse` row (~line 4129), same three-column shape:

```markdown
| `meal_rhythm_drift` | over a `window-days` rolling window ending YESTERDAY, with at least `min-days-with-meals` days carrying a logged meal: **slot drift** — a planned slot's actual logged time (earliest row of that `slotKind` that day) deviates from its planned time by a median of more than `drift-minutes`, with at least `min-same-direction-share` of the observed days drifting the same way — OR **dead slot** — a slot planned on ≥ `min-slot-planned-days` days carries a meal on ≤ `dead-slot-max-presence` of them while the other tracked slots average ≥ `other-slots-min-presence`. Only `fixed`-anchor slots can drift (relative anchors are resolved in the FRONTEND only); `snack` and any duplicated `slotKind` are excluded as ambiguous; the day's template is chosen by a DERIVED day type (`resolveDayType.ts` ported: no completed instance ⇒ rest, earliest start before noon ⇒ training_am, else training_pm), and a training day with no `startedAt` is skipped entirely; deviations use a SIGNED CIRCULAR minute difference in `(-720, 720]`, never `LateEatingRule`'s +24 shift | `meal_slot_template`, `meal`, `WorkoutSessionRepository.findDoneInstancesBetween` |
```

Then extend the §3 narrative near line 1607 (where `protocol_lapse` is introduced) with one sentence: the round-2 S4 detection, its two sub-triggers, and that it is a plan-edit offer rather than an adherence judgement. Add `meal_rhythm_drift` to the "stay counted as problems" sentence at ~line 4145 with its one-clause reason (a genuine behaviour observation, not a data gap).

- [ ] **Step 2: Extend `docs/features/proactive.md`.** Add a bullet after the `(mm)` `protocol_lapse_resume` bullet (~line 3004):

```markdown
- **(nn) Round 2 S4 (bd `mezo-d58h.7.4`, spec 2026-09-05 §(13)) adds `meal_rhythm_adjust`, the
  `meal_rhythm_drift` intervention-library entry.** `channel: feed` (a plan-edit offer never
  earns a push) and `cooldown-hours: 336`, which MUST stay equal to
  `mezo.companion.flags.cooldown-hours.meal-rhythm-drift` — `InterventionService.deliverForFlag`
  applies the LIBRARY entry's own per-key cooldown, so a mismatch silently overrides the spec's
  14-day cadence (the `protocol_lapse_resume` review lesson, one slice earlier). The copy is a
  neutral observation that offers to edit the PLAN; the specific slot, both clock times and the
  ratios come from `AdviceFactRenderer`, never from this text.
```

Also add the severity-order sentence near line 958 (where `protocol_lapse`'s rank is explained): `meal_rhythm_drift` ranks immediately after it, still ahead of the setup checks.

- [ ] **Step 3: Regenerate the codemap.**

```bash
node scripts/gen-codemap.mjs
```

- [ ] **Step 4: Commit the docs.**

```bash
git add docs
git commit -m "docs(companion,proactive): document the meal_rhythm_drift detection (mezo-d58h.7.4)"
```

- [ ] **Step 5: Push and open the self-PR (the CI gate).**

```bash
git push -u origin feat/proactive-round2-s4-meal-rhythm-drift
```

```bash
gh pr create --title "feat(companion): meal_rhythm_drift detection — round 2 S4 (mezo-d58h.7.4)" --body "$(cat <<'EOF'
## Summary
Round 2 slice S4 of the proactive-coaching spec (§(13)): the `meal_rhythm_drift` flag — the meal-slot plan and the logged reality drifting apart, as one neutral observation card offering to edit the plan.

Two sub-triggers under one key over a 14-day window ending yesterday:
- **slot drift** — a `fixed`-anchor slot's actual median logged time is >90 min from plan, consistently in one direction;
- **dead slot** — a planned slot is logged on ≤30% of its planned days while the others average ≥70%.

Honesty gates: no template, <10 days with meals, or no trackable slot ⇒ `UNAVAILABLE`. Snacks and duplicated slot kinds are excluded as ambiguous; relative anchors are never resolved (frontend-only); day type is derived per `resolveDayType.ts`; clock deltas are signed-circular.

## Test plan
- `FlagEvaluatorMealRhythmDriftIT` — both arms fire, past-midnight, single-outlier, chaotic-direction, three honesty gates, relative anchor, duplicate kind, training-day template selection, never-today.
- `MealRhythmDriftRuleSwitchOffIT`, `InterventionServiceIT`, `AdviceFactRendererTest`, `AdvicePriorityTest`, `InterventionConfigIT`, `FlagPropertiesIT`, `CompanionFlagLogPersistenceIT`.
- Full suite: this PR's CI run.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: Wait for CI green, re-check against current main, merge locally with `--no-ff`.**

```bash
gh pr checks --watch
```

```bash
gh workflow run premerge.yml -f pr=<number>
```

Then the house merge flow: `git switch main && git pull --rebase && git merge --no-ff feat/proactive-round2-s4-meal-rhythm-drift && git push && git branch -d feat/proactive-round2-s4-meal-rhythm-drift`.

- [ ] **Step 7: Close the issue and refresh the tracker backup.**

```bash
bd close mezo-d58h.7.4 && node scripts/check-beads-backup.mjs --fix
```

Commit the refreshed `.beads/issues.jsonl` and push.

---

## Self-review notes

- **Spec coverage.** §(13)'s 14-day window, 10-day minimum, both sub-triggers with their exact thresholds (90 min / 30% / 70%), the neutral phrasing and the 14-day cooldown all map to Tasks 2–6. §"Error handling and edge cases": silence-by-default (Task 4 gates + Task 5 tests), the wall-clock convention (Trap 3 + `createBareMealAt`), the CHECK widening (Task 2, both tables), the switch layout (Task 5), the `AdvicePriority` mandate (Task 2). §"Testing strategy": fires / silence / too-little-data / switch-off are all present; the cooldown itself is `FlagService`'s generic, already-covered behaviour, so it is asserted as a bound config value (`FlagPropertiesIT`) rather than re-tested per rule.
- **Deliberate spec deviation.** The spec's §(13) sketch says "a planned slot has meal rows on <30% of window days"; this plan measures presence over the days the slot was actually **planned** (day-type-correct), not raw window days. Measuring against raw window days would make a slot that only exists in the rest-day template look dead for every training day. The stricter reading is a strictly more honest version of the same rule.
- **Interaction to watch after merge.** With fifteen rules, `all_healthy` gets one more way to be suppressed. That is by design (`meal_rhythm_drift` stays counted), but the 336h cooldown means it can only affect one week in two.
