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
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_MEAL_DAYS);
    }

    /** Honesty gate: no template at all means there is no plan for reality to drift away from —
     *  that is slot-template setup territory, not this rule's. */
    @Test
    void stays_silent_when_the_user_has_no_slot_template() {
        UUID owner = userPopulator.createUser().getId();
        logDays(owner, WINDOW, LocalTime.of(22, 0));

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.MEAL_RHYTHM_DRIFT);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_SLOT_TEMPLATE);
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
