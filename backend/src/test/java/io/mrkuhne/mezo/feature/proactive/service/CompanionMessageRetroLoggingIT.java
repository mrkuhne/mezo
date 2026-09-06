package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S3 (bd mezo-d58h.7.3, spec §9) — the batch-logger FACT block the midday/evening window
 * payload carries. Lives in the {@code ...proactive.service} package so it can assert the
 * package-private block builder directly (the {@code CompanionMessageHydrationIT} precedent),
 * instead of guessing at prompt text through a scripted answer.
 *
 * <p>Fixture rule as in {@code RetroLoggingProbeIT}: a past-dated meal is retro unless its
 * {@code created_at} is force-backdated onto its own {@code meal_date}.
 */
class CompanionMessageRetroLoggingIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;

    private void retroMeal(UUID owner, int daysAgo) {
        mealPopulator.createBareMeal(owner, TODAY.minusDays(daysAgo), "lunch");
    }

    private void sameDayMeal(UUID owner, int daysAgo) {
        LocalDate day = TODAY.minusDays(daysAgo);
        mealPopulator.createBareMealCreatedAt(owner, day, "lunch",
                day.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant());
    }

    @Test
    void testBatchLoggerBlock_shouldCarryTheRealNumbers_whenTheHabitHolds() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            retroMeal(owner, i);
        }
        for (int i = 7; i <= 10; i++) {
            sameDayMeal(owner, i);
        }
        mealPopulator.createBareMeal(owner, TODAY, "breakfast");

        String block = companionMessageGenerator.batchLoggerBlock(owner, TODAY);

        assertThat(block).contains("NAPLÓZÁSI SZOKÁS")
                .contains("14 nap 10 étkezéséből 6 (60%)")
                .contains("ma eddig 1 étkezés")
                .contains("NE vedd kimaradt étkezésnek");
    }

    /** A user who writes the day as it happens gets no block at all. */
    @Test
    void testBatchLoggerBlock_shouldBeEmpty_whenTheUserLogsSameDay() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 10; i++) {
            sameDayMeal(owner, i);
        }

        assertThat(companionMessageGenerator.batchLoggerBlock(owner, TODAY)).isEmpty();
    }

    /** Too little data ⇒ silence, however retro the few rows are. */
    @Test
    void testBatchLoggerBlock_shouldBeEmpty_whenThereIsTooLittleData() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 5; i++) {
            retroMeal(owner, i);
        }

        assertThat(companionMessageGenerator.batchLoggerBlock(owner, TODAY)).isEmpty();
    }

    /** Nothing logged at all is "unobserved", not "batch logger". */
    @Test
    void testBatchLoggerBlock_shouldBeEmpty_whenNothingIsLogged() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(companionMessageGenerator.batchLoggerBlock(owner, TODAY)).isEmpty();
    }
}
