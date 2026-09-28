package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Card worthiness (mezo-3n2so, spec §5.1): shared between the weekly-card read and the bell — a
 * week is only "worth saying" when it moved the base, excluded a day, or is holding.
 */
class WeeklyCardPolicyTest {

    @Test
    void nonZeroStepIsWorthSaying() {
        assertThat(WeeklyCardPolicy.worthSaying(row("UPDATED", 60, List.of()))).isTrue();
        assertThat(WeeklyCardPolicy.worthSaying(row("UPDATED", -60, List.of()))).isTrue();
    }

    @Test
    void excludedDaysAreWorthSaying() {
        List<ExcludedIntakeDayJson> excluded = List.of(new ExcludedIntakeDayJson(LocalDate.of(2026, 9, 16), 604, "suspicious"));
        assertThat(WeeklyCardPolicy.worthSaying(row("STABLE", 0, excluded))).isTrue();
    }

    @Test
    void holdingIsWorthSaying() {
        assertThat(WeeklyCardPolicy.worthSaying(row("HOLDING", 0, List.of()))).isTrue();
    }

    @Test
    void quietStableWeekIsNotWorthSaying() {
        assertThat(WeeklyCardPolicy.worthSaying(row("STABLE", 0, List.of()))).isFalse();
    }

    private static ExpenditureEstimateEntity row(String status, int step, List<ExcludedIntakeDayJson> excluded) {
        ExpenditureEstimateEntity e = new ExpenditureEstimateEntity();
        e.setStatus(status);
        e.setStepKcal(step);
        e.setExcludedDays(excluded);
        return e;
    }
}
