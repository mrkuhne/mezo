package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.port.DailyIntakePort;
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
 * {@link GoalDailyIntakeAdapter} over {@link FuelDayService#getWeek} — only LOGGED days (consumed
 * kcal > 0) are returned, ascending by date, kcal/carbs rounded HALF_UP to int.
 */
@Transactional
class GoalDailyIntakeAdapterIT extends AbstractIntegrationTest {

    @Autowired private GoalDailyIntakeAdapter adapter;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MealPopulator mealPopulator;

    private UUID userId;

    @BeforeEach
    void setUp() {
        userId = databasePopulator.populateUser("daily-intake@test.local");
    }

    private void seedMeal(LocalDate date, String kcal, String carbs) {
        mealPopulator.createMealWithItems(userId, date, "lunch",
            List.of(new MealPopulator.Line("Food", kcal, "150", carbs, "70", (short) 1)));
    }

    @Test
    void returnsOnlyLoggedDaysAscendingWithRoundedTotals() {
        LocalDate from = LocalDate.of(2026, 9, 7);
        LocalDate to = LocalDate.of(2026, 9, 16);

        seedMeal(from.plusDays(5), "1900.4", "200.4"); // 2026-09-12, logged out of order
        seedMeal(from, "2100.5", "250.5");              // 2026-09-07
        seedMeal(from.plusDays(2), "1800.49", "180.49"); // 2026-09-09
        // from.plusDays(1) (2026-09-08) stays unlogged — must not appear

        List<DailyIntakePort.DayIntake> result = adapter.between(userId, from, to);

        assertThat(result).extracting(DailyIntakePort.DayIntake::date)
            .containsExactly(from, from.plusDays(2), from.plusDays(5));
        assertThat(result.get(0).kcal()).isEqualTo(2101); // HALF_UP
        assertThat(result.get(0).carbsG()).isEqualTo(251); // HALF_UP
        assertThat(result.get(1).kcal()).isEqualTo(1800);
        assertThat(result.get(1).carbsG()).isEqualTo(180);
        assertThat(result.get(2).kcal()).isEqualTo(1900);
        assertThat(result.get(2).carbsG()).isEqualTo(200);
    }

    @Test
    void emptyRangeReturnsEmptyList() {
        LocalDate from = LocalDate.of(2026, 9, 7);
        LocalDate to = LocalDate.of(2026, 9, 16);

        List<DailyIntakePort.DayIntake> result = adapter.between(userId, from, to);

        assertThat(result).isEmpty();
    }

    @Test
    void scopesToOwner() {
        UUID other = databasePopulator.populateUser("daily-intake-other@test.local");
        LocalDate from = LocalDate.of(2026, 9, 7);
        LocalDate to = LocalDate.of(2026, 9, 16);
        mealPopulator.createMealWithItems(other, from, "lunch",
            List.of(new MealPopulator.Line("Food", "2100", "150", "150", "70", (short) 1)));

        List<DailyIntakePort.DayIntake> result = adapter.between(userId, from, to);

        assertThat(result).isEmpty();
    }
}
