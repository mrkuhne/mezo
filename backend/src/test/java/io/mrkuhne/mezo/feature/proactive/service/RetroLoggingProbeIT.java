package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S3 (bd mezo-d58h.7.3, spec §9) — the retro/batch-logging detection and, above all, its
 * silence gates.
 *
 * <p>Fixture rule: {@code created_at} is {@code @CreationTimestamp}, so every row persisted here
 * is stamped "now". A window row (dated in the past) is therefore RETRO unless the populator
 * force-backdates its {@code created_at} onto its own {@code meal_date} — which is exactly what
 * {@code createBareMealCreatedAt} is for. Defaults under test: 14-day window ending YESTERDAY,
 * 10 meals minimum, 40 % threshold.
 */
class RetroLoggingProbeIT extends AbstractIntegrationTest {

    @Autowired private RetroLoggingProbe retroLoggingProbe;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;

    private static final LocalDate TODAY = LocalDate.now();

    /** Written later than the day it is about. */
    private void retroMeal(UUID owner, int daysAgo) {
        mealPopulator.createBareMeal(owner, TODAY.minusDays(daysAgo), "lunch");
    }

    /** Written on the day it is about. */
    private void sameDayMeal(UUID owner, int daysAgo) {
        LocalDate day = TODAY.minusDays(daysAgo);
        mealPopulator.createBareMealCreatedAt(owner, day, "lunch",
                day.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant());
    }

    /** 10 window meals, 4 of them retro — exactly the 40 % threshold. */
    private UUID batchLogger() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 4; i++) {
            retroMeal(owner, i);
        }
        for (int i = 5; i <= 10; i++) {
            sameDayMeal(owner, i);
        }
        return owner;
    }

    @Test
    void testEvaluate_shouldReportTheMeasuredRatio_whenTheThresholdIsMet() {
        UUID owner = batchLogger();

        Optional<RetroLoggingProbe.BatchLogging> result = retroLoggingProbe.evaluate(owner, TODAY);

        assertThat(result).isPresent();
        assertThat(result.get().windowDays()).isEqualTo(14);
        assertThat(result.get().totalMeals()).isEqualTo(10);
        assertThat(result.get().retroMeals()).isEqualTo(4);
        assertThat(result.get().retroPct()).isEqualTo(40);
        assertThat(result.get().mealsLoggedToday()).isZero();
    }

    /** 3 of 10 = 30 %: a bit of catching up is not a habit. */
    @Test
    void testEvaluate_shouldBeEmpty_whenTheRatioIsBelowTheThreshold() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 3; i++) {
            retroMeal(owner, i);
        }
        for (int i = 4; i <= 10; i++) {
            sameDayMeal(owner, i);
        }

        assertThat(retroLoggingProbe.evaluate(owner, TODAY)).isEmpty();
    }

    /** 9 meals, ALL retro — 100 %, but under the coverage floor: too little data ⇒ silence. */
    @Test
    void testEvaluate_shouldBeEmpty_whenTheWindowHasTooFewMeals() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 9; i++) {
            retroMeal(owner, i);
        }

        assertThat(retroLoggingProbe.evaluate(owner, TODAY)).isEmpty();
    }

    /** A user who logs nothing is unobserved, not a batch logger. */
    @Test
    void testEvaluate_shouldBeEmpty_whenThereAreNoMealsAtAll() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(retroLoggingProbe.evaluate(owner, TODAY)).isEmpty();
    }

    /** Today is state, never ratio input: 2 meals today leave total/retro/pct untouched. */
    @Test
    void testEvaluate_shouldCountTodaySeparately_whenMealsAreAlreadyLoggedToday() {
        UUID owner = batchLogger();
        mealPopulator.createBareMeal(owner, TODAY, "breakfast");
        mealPopulator.createBareMeal(owner, TODAY, "lunch");

        Optional<RetroLoggingProbe.BatchLogging> result = retroLoggingProbe.evaluate(owner, TODAY);

        assertThat(result).isPresent();
        assertThat(result.get().mealsLoggedToday()).isEqualTo(2);
        assertThat(result.get().totalMeals()).isEqualTo(10);
        assertThat(result.get().retroPct()).isEqualTo(40);
    }

    /** Meals older than the window cannot resurrect a ratio (day 15 is outside 14). */
    @Test
    void testEvaluate_shouldIgnoreMeals_whenTheyPredateTheWindow() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 15; i <= 30; i++) {
            retroMeal(owner, i);
        }

        assertThat(retroLoggingProbe.evaluate(owner, TODAY)).isEmpty();
    }

    /** B-user rule: another owner's meals are invisible. */
    @Test
    void testEvaluate_shouldBeEmpty_whenOnlyAnotherUserLoggedMeals() {
        UUID owner = userPopulator.createUser().getId();
        batchLogger();

        assertThat(retroLoggingProbe.evaluate(owner, TODAY)).isEmpty();
    }
}
