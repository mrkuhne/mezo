package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaise;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Spec 2026-09-03 §4 row 2 (rank 2): 7-day {@code COMBINED_LOAD_MIN} above threshold AND
 * (7-day kcal average below 80% of target OR 7-day sleep average below 7h). Honesty gate:
 * the "≥4 logged days" count comes from the SPARSE kcal/sleep series, never from the
 * calendar-complete load series (an unlogged day there is a real 0.0, not an absence).
 */
class FlagEvaluatorLoadFuelMismatchIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return evaluator.evaluate(owner).stream().map(FlagRaise::flagKey).toList();
    }

    /** 100 min/day sport for all 7 days ⇒ load avg 100.0, well above the 50.0 threshold. */
    private void highLoadWeek(UUID owner, LocalDate today) {
        for (int i = 0; i < 7; i++) {
            trainPopulator.createSportSession(owner, today.minusDays(i), 100);
        }
    }

    /** A cheap pantry item (110 kcal) logged once/day ⇒ far under the 3100 default target. */
    private void lowKcalDays(UUID owner, LocalDate today, int days) {
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "load-fuel-item",
            today.plusMonths(1));
        for (int i = 0; i < days; i++) {
            mealPopulator.createPantryMeal(owner, item, today.minusDays(i));
        }
    }

    private void adequateSleepDays(UUID owner, LocalDate today, int days) {
        for (int i = 0; i < days; i++) {
            sleepLogPopulator.createSleepLog(owner, today.minusDays(i), new BigDecimal("8.0"), 3);
        }
    }

    private void lowSleepDays(UUID owner, LocalDate today, int days) {
        for (int i = 0; i < days; i++) {
            sleepLogPopulator.createSleepLog(owner, today.minusDays(i), new BigDecimal("5.0"), 3);
        }
    }

    @Test
    void raises_when_load_is_high_and_kcal_is_under_the_target() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today);
        lowKcalDays(owner, today, 7); // ~110 kcal avg vs 3100 target ⇒ well under 80%
        adequateSleepDays(owner, today, 7); // rules out the sleep arm as the cause

        assertThat(keys(owner)).contains(FlagKey.LOAD_FUEL_MISMATCH);
    }

    @Test
    void raises_when_load_is_high_and_sleep_is_under_the_floor() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today);
        lowSleepDays(owner, today, 7); // 5.0h avg < 7.0h floor
        // adequate kcal so the kcal arm cannot be the cause
        for (int i = 0; i < 7; i++) {
            mealPopulator.createMealWithItems(owner, today.minusDays(i), "lunch",
                List.of(new MealPopulator.Line("big-meal", "3000", "150", "300", "80", (short) 1)));
        }

        assertThat(keys(owner)).contains(FlagKey.LOAD_FUEL_MISMATCH);
    }

    @Test
    void stays_silent_when_load_is_high_but_fuel_and_sleep_are_adequate() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today);
        adequateSleepDays(owner, today, 7);
        for (int i = 0; i < 7; i++) {
            mealPopulator.createMealWithItems(owner, today.minusDays(i), "lunch",
                List.of(new MealPopulator.Line("big-meal", "3000", "150", "300", "80", (short) 1)));
        }

        assertThat(keys(owner)).doesNotContain(FlagKey.LOAD_FUEL_MISMATCH);
    }

    /**
     * THE TRAP: COMBINED_LOAD_MIN is calendar-complete, so the load series alone would suggest a
     * full 7 "logged" days even though only 3 kcal days and 0 sleep days are actually logged. If
     * the honesty gate were (wrongly) counted from the load series, this would raise on the kcal
     * arm; counted correctly from the sparse kcal/sleep series (3 < minLoggedDaysPerSide=4, and
     * 0 < 4), it must stay silent.
     */
    @Test
    void stays_silent_when_only_three_kcal_days_are_logged_despite_a_full_load_week() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today); // load series has a real value for all 7 days
        lowKcalDays(owner, today, 3); // only 3 logged kcal days, all far under target
        // no sleep logged at all

        assertThat(keys(owner)).doesNotContain(FlagKey.LOAD_FUEL_MISMATCH);
    }

    @Test
    void the_payload_carries_the_weight_trend_when_weigh_ins_exist() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today);
        lowKcalDays(owner, today, 7);
        adequateSleepDays(owner, today, 7);
        for (int i = 0; i < 7; i++) {
            weightLogPopulator.createWeightLog(owner, today.minusDays(i),
                new BigDecimal("80.0").subtract(new BigDecimal("0.1").multiply(new BigDecimal(6 - i))));
        }

        FlagRaise raise = evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.LOAD_FUEL_MISMATCH.equals(r.flagKey())).findFirst().orElseThrow();

        assertThat(raise.payload().loadFuelMismatch().weightTrendPctWk()).isNotNull();
    }

    @Test
    void the_payload_omits_the_weight_trend_without_weigh_ins_and_does_not_change_firing() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today);
        lowKcalDays(owner, today, 7);
        adequateSleepDays(owner, today, 7);

        FlagRaise raise = evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.LOAD_FUEL_MISMATCH.equals(r.flagKey())).findFirst().orElseThrow();

        assertThat(raise.payload().loadFuelMismatch().weightTrendPctWk()).isNull();
    }

    @Test
    void the_payload_freezes_the_load_and_kcal_inputs_and_names_the_firing_arm() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        highLoadWeek(owner, today);
        lowKcalDays(owner, today, 7);
        adequateSleepDays(owner, today, 7);

        FlagRaise raise = evaluator.evaluate(owner).stream()
            .filter(r -> FlagKey.LOAD_FUEL_MISMATCH.equals(r.flagKey())).findFirst().orElseThrow();

        var p = raise.payload().loadFuelMismatch();
        assertThat(p.loadThreshold()).isEqualTo(50.0);
        assertThat(p.loadAvg()).isGreaterThanOrEqualTo(50.0);
        assertThat(p.kcalLoggedDays()).isEqualTo(7);
        assertThat(p.sleepLoggedDays()).isEqualTo(7);
        assertThat(p.firedArm()).isEqualTo("kcal");
    }
}
