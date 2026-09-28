package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.companion.service.DayScoreService;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.companion.service.MetricSeriesService;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator.Line;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** Check-in 2.0 follow-up B: the DAY_SCORE and NOVA4_KCAL_PCT series behind the two new pairs. */
@Transactional
@ActiveProfiles("companion-fake")
class MetricSeriesFollowupIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private MetricSeriesService metricSeriesService;
    @Autowired private DayScoreService dayScoreService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private SleepLogPopulator sleepLogPopulator;

    @Test
    void testNova4Pct_shouldShareClassifiedKcal_whenCoverageHigh() {
        UUID owner = userPopulator.createUser().getId();
        // 300 kcal NOVA 4 of 1000 classified kcal → 30 %.
        mealPopulator.createMealWithItems(owner, DAY, "lunch", List.of(
            new Line("fu-csirke", "700", "40", "0", "10", (short) 1),
            new Line("fu-chips", "300", "3", "30", "20", (short) 4)));

        Map<LocalDate, Double> series = metricSeriesService.series(owner, MetricKey.NOVA4_KCAL_PCT, DAY, DAY);

        assertThat(series.get(DAY)).isCloseTo(30.0, within(1e-9));
    }

    @Test
    void testNova4Pct_shouldHaveNoPoint_whenLessThanSeventyPercentClassified() {
        UUID owner = userPopulator.createUser().getId();
        MealEntity meal = mealPopulator.createMealWithItems(owner, DAY, "lunch", List.of(
            new Line("fu-leves", "400", "10", "30", "10", (short) 1),
            new Line("fu-keksz", "600", "5", "80", "25", (short) 4)));
        meal.getItems().get(1).setSnapshotNova(null); // 60 % of the kcal is unclassified
        mealRepository.saveAndFlush(meal);

        assertThat(metricSeriesService.series(owner, MetricKey.NOVA4_KCAL_PCT, DAY, DAY)).isEmpty();
    }

    @Test
    void testDayScore_shouldMirrorEngineBase_forClosedDaysOnly() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        for (int d = 0; d <= 2; d++) {
            sleepLogPopulator.createSleepLog(owner, today.minusDays(d), new BigDecimal("7.5"), 8);
        }

        Map<LocalDate, Double> series =
            metricSeriesService.series(owner, MetricKey.DAY_SCORE, today.minusDays(2), today);

        assertThat(series).doesNotContainKey(today); // today's score is still moving
        dayScoreService.scores(owner, today.minusDays(2), today.minusDays(1)).forEach(day -> {
            if (day.score() == null) {
                assertThat(series).doesNotContainKey(day.date());
            } else {
                assertThat(series.get(day.date())).isEqualTo(day.score().doubleValue());
            }
        });
        assertThat(series).isNotEmpty();
    }
}
