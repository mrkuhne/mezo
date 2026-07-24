package io.mrkuhne.mezo.feature.habit;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.service.HabitEvaluator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FuelSettingsPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.RitualPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.SupplementIntakePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Per-metric evaluation over already-logged data — the honesty contract: every DERIVED metric is a
 * pure repo read, never a self-claim, and an unknown metric degrades to {@code false}. Data is
 * deterministic (populators + backdated timestamps), independent of the wall clock.
 *
 * <p>{@code training_done_today} is asserted via the GYM branch (a completed instance dated today,
 * no time gate — spec's "a gym session finished"): the RUN branch keys off the log's
 * {@code created_at} against {@code workout-cutoff 12:00}, which a populator cannot pin without
 * backdating, so a run-based happy path would be time-of-day flaky.
 */
class HabitEvaluatorIT extends AbstractIntegrationTest {

    @Autowired private HabitEvaluator evaluator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private SupplementIntakePopulator supplementIntakePopulator;
    @Autowired private FuelSettingsPopulator fuelSettingsPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RitualPopulator ritualPopulator;

    private UUID owner() {
        return userPopulator.createUser("habit-eval@test.hu").getId();
    }

    private static Instant at(LocalDate date, String hhmm) {
        return LocalDateTime.of(date, LocalTime.parse(hhmm)).atZone(ZoneId.systemDefault()).toInstant();
    }

    @Test
    void testSatisfied_shouldPassWakeWindow_whenWakeupInsideWindow() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, d, "23:10", "06:20", new BigDecimal("7.2"));
        assertThat(evaluator.satisfied("sleep_wake_window", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailWakeWindow_whenWakeupTooLate() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, d, "23:10", "07:30", new BigDecimal("7.2"));
        assertThat(evaluator.satisfied("sleep_wake_window", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldRespectWeighInCutoff_whenCreatedAtVaries() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        weightLogPopulator.createWeightLogAt(owner, d, new BigDecimal("81.4"), at(d, "07:45"));
        assertThat(evaluator.satisfied("weight_logged_before", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailWeighIn_whenLoggedAfterCutoff() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        weightLogPopulator.createWeightLogAt(owner, d, new BigDecimal("81.4"), at(d, "11:15"));
        assertThat(evaluator.satisfied("weight_logged_before", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldPassMorningCoffee_whenStimIntakeBeforeWindowEnd() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var stim = pantryItemPopulator.createStim(owner, "Tasty Dose gombakávé");
        supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "06:40"));
        assertThat(evaluator.satisfied("stim_intake_before", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldPassTraining_whenGymSessionCompletedToday() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var meso = trainPopulator.createActiveMeso(owner);
        var day = trainPopulator.createTemplateDay(owner, meso.getId(), "Nap A");
        trainPopulator.createWorkoutInstance(owner, day, d, "completed");
        assertThat(evaluator.satisfied("training_done_today", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailTraining_whenNothingTrainedToday() {
        UUID owner = owner();
        assertThat(evaluator.satisfied("training_done_today", owner, LocalDate.now())).isFalse();
    }

    @Test
    void testSatisfied_shouldPassBreakfastProtein_whenBreakfastMealMeetsTarget() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var item = pantryItemPopulator.createFood(owner, "Skyr", null);
        mealPopulator.createPantryMeal(owner, item, d); // breakfast, 34.5 g protein
        assertThat(evaluator.satisfied("breakfast_protein", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailCaffeineCutoff_whenStimTakenAfterCutoff() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var stim = pantryItemPopulator.createStim(owner, "Origin pre-workout");
        supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "16:00"));
        assertThat(evaluator.satisfied("no_stim_after", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldPassCaffeineCutoff_whenNoLateStim() {
        UUID owner = owner();
        assertThat(evaluator.satisfied("no_stim_after", owner, LocalDate.now())).isTrue();
    }

    @Test
    void testSatisfied_shouldUseFuelSettingsCutoff_whenRowExists() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        fuelSettingsPopulator.settings(owner, 4, "17:00"); // personal cutoff later than the ghost
        var stim = pantryItemPopulator.createStim(owner, "Origin pre-workout");
        supplementIntakePopulator.createIntake(owner, stim.getId(), at(d, "16:00"));

        // 16:00 intake is BEFORE the personal 17:00 cutoff -> satisfied (would fail on the 14:00 ghost).
        assertThat(evaluator.satisfied("no_stim_after", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldEvaluateKitchenClose_onLastMealTime() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        var item = pantryItemPopulator.createFood(owner, "Rizs", null);
        mealPopulator.createPantryMeal(owner, item, d, at(d, "19:30"));
        assertThat(evaluator.satisfied("last_meal_before", owner, d)).isTrue();
        mealPopulator.createPantryMeal(owner, item, d, at(d, "22:40"));
        assertThat(evaluator.satisfied("last_meal_before", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldEvaluateBedtimeNextDay_withMidnightWrap() {
        UUID owner = owner();
        // Anchor bed target explicitly at 23:00 (was the old config ghost; ghost is now 22:00 — spec §3).
        sleepGoalPopulator.goal(owner, 450, "BED", "23:00", 15);
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d.plusDays(1), "23:15", "06:30", new BigDecimal("7.0"));
        assertThat(evaluator.satisfied("bedtime_next_day", owner, d)).isTrue();
    }

    @Test
    void testSatisfied_shouldFailBedtime_whenAfterMidnight() {
        UUID owner = owner();
        // Anchor bed target explicitly at 23:00 (was the old config ghost; ghost is now 22:00 — spec §3).
        sleepGoalPopulator.goal(owner, 450, "BED", "23:00", 15);
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d.plusDays(1), "00:40", "07:10", new BigDecimal("6.5"));
        assertThat(evaluator.satisfied("bedtime_next_day", owner, d)).isFalse();
    }

    @Test
    void testSatisfied_shouldReturnFalse_whenMetricUnknown() {
        assertThat(evaluator.satisfied("nope", owner(), LocalDate.now())).isFalse();
    }

    @Test
    void testSatisfied_shouldCompleteRitualClosed_whenRitualDayRowExists() {
        UUID owner = owner();
        LocalDate d = LocalDate.now();
        assertThat(evaluator.satisfied("ritual_closed", owner, d)).isFalse();
        ritualPopulator.closedDay(owner, d);
        assertThat(evaluator.satisfied("ritual_closed", owner, d)).isTrue();
    }
}
