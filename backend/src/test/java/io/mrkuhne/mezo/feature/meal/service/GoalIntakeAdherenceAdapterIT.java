package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.port.IntakeAdherencePort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * {@link GoalIntakeAdherenceAdapter} over {@link FuelDayService#getWeek} — averages over LOGGED
 * days only (consumed kcal > 0); an all-zero week returns {@code new IntakeAdherence(0, 0, 0)}.
 */
@Transactional
class GoalIntakeAdherenceAdapterIT extends AbstractIntegrationTest {

    @Autowired private GoalIntakeAdherenceAdapter adapter;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MealPopulator mealPopulator;

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = databasePopulator.populateUser("intake-adherence@test.local");
    }

    private void seedMeal(LocalDate date, String kcal) {
        mealPopulator.createMealWithItems(userId, date, "lunch",
            List.of(new MealPopulator.Line("Food", kcal, "150", "150", "70", (short) 1)));
    }

    @Test
    void averagesOverLoggedDaysOnly() {
        LocalDate monday = LocalDate.of(2026, 8, 24);
        seedMeal(monday, "2100");           // one logged day
        seedMeal(monday.plusDays(2), "1900"); // second logged day

        IntakeAdherencePort.IntakeAdherence a = adapter.weekAdherence(userId, monday);

        assertThat(a.loggedDays()).isEqualTo(2);
        assertThat(a.avgIntakeKcal()).isEqualTo(2000);
        assertThat(a.avgTargetKcal()).isGreaterThan(0); // config fallback target without a goal
    }

    @Test
    void emptyWeekIsZeroes() {
        IntakeAdherencePort.IntakeAdherence a = adapter.weekAdherence(userId, LocalDate.of(2026, 8, 24));

        assertThat(a).isEqualTo(new IntakeAdherencePort.IntakeAdherence(0, 0, 0));
    }

    @Test
    void scopesToOwner() {
        UUID other = databasePopulator.populateUser("intake-adherence-other@test.local");
        LocalDate monday = LocalDate.of(2026, 8, 24);
        mealPopulator.createMealWithItems(other, monday, "lunch",
            List.of(new MealPopulator.Line("Food", "2100", "150", "150", "70", (short) 1)));

        IntakeAdherencePort.IntakeAdherence a = adapter.weekAdherence(userId, monday);

        assertThat(a).isEqualTo(new IntakeAdherencePort.IntakeAdherence(0, 0, 0));
    }
}
