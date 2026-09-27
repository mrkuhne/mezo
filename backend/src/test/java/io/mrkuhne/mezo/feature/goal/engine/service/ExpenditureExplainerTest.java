package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureFilter.Day;
import io.mrkuhne.mezo.feature.goal.engine.service.ExpenditureFilter.DayTrace;
import io.mrkuhne.mezo.feature.goal.engine.service.IntakeDayClassifier.Status;
import io.mrkuhne.mezo.feature.goal.entity.ExcludedIntakeDayJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson.SeriesPoint;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureExplanationJson.WaterEvent;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The "Hogy tanultam?" aggregates (mezo-y72o3) — pure arithmetic over a hand-built window + trace. */
class ExpenditureExplainerTest {

    private static final LocalDate D0 = LocalDate.of(2026, 6, 1);
    private static final int N = 70;

    /**
     * 70 days: days 0–4 (before any data) and day 30 unlogged, day 10 suspicious (500), day 20 marked (900),
     * the rest usable at 2400; movement 300, 370 on every 7th day, 1000 on the data-less days 0–4; weigh-ins every other day from day 7; the trace from day 7
     * loses 0.01 kg tissue a day with 0.1 kg water, glycogen 1.0 on days 40–44 and 0.9/1.5 on days 60/61.
     */
    private static ExpenditureExplainer.Input input(boolean withUsable, boolean withTrace) {
        List<Day> days = new ArrayList<>();
        Map<LocalDate, Status> status = new LinkedHashMap<>();
        Map<LocalDate, Integer> logged = new HashMap<>();
        List<DayTrace> trace = new ArrayList<>();
        for (int i = 0; i < N; i++) {
            LocalDate d = D0.plusDays(i);
            Status s = i < 5 || i == 30 ? Status.UNLOGGED : i == 10 ? Status.SUSPICIOUS : i == 20 ? Status.MARKED_INCOMPLETE
                : withUsable ? Status.USABLE : Status.UNLOGGED;
            status.put(d, s);
            Integer kcal = s == Status.UNLOGGED ? null : i == 10 ? 500 : i == 20 ? 900 : 2400;
            if (kcal != null) {
                logged.put(d, kcal);
            }
            Double w = i >= 7 && (i - 7) % 2 == 0 ? 81.0 - 0.01 * i : null;
            days.add(new Day(d, s == Status.USABLE ? kcal : null, null, i < 5 ? 1000 : i % 7 == 0 ? 370 : 300, -300, w));
            if (withTrace && i >= 7) {
                double g = i >= 40 && i <= 44 ? 1.0 : i == 60 ? 0.9 : i == 61 ? 1.5 : 0;
                trace.add(new DayTrace(d, 80.0 - 0.01 * (i - 7), 0.1, g));
            }
        }
        return new ExpenditureExplainer.Input(D0, D0.plusDays(N - 1), days, status, logged, trace, 2250, 7700, 0.8);
    }

    @Test
    void countsCoverTheWholeWindow() {
        ExpenditureExplanationJson x = ExpenditureExplainer.explain(input(true, true));

        assertThat(x.windowStart()).isEqualTo(D0);
        assertThat(x.windowEnd()).isEqualTo(D0.plusDays(69));
        assertThat(x.usableDays()).isEqualTo(62);
        assertThat(x.weighInDays()).isEqualTo(32);
        // Counted from the first day with data (day 5): the empty days 0–4 are "before", not "unlogged".
        assertThat(x.dataStart()).isEqualTo(D0.plusDays(5));
        assertThat(x.unloggedDays()).isEqualTo(1);
        assertThat(x.historyWeeks()).isEqualTo(9); // day 7 → day 69 = 63 days
        assertThat(x.startBaseKcal()).isEqualTo(2250);
    }

    @Test
    void theSimpleArithmeticAddsUpFromItsShownParts() {
        ExpenditureExplanationJson x = ExpenditureExplainer.explain(input(true, true));

        assertThat(x.avgIntakeKcal()).isEqualTo(2400);
        // Over the 62 usable days only (53 × 300 + 9 × 370) — the 1000-kcal data-less days never count.
        assertThat(x.avgMovementKcal()).isEqualTo(310);
        assertThat(x.tissueRateKgPerWeek()).isEqualByComparingTo("-0.07");
        assertThat(x.tissueKcalPerDay()).isEqualTo(-77);
        assertThat(x.simpleBaseKcal()).isEqualTo(2400 + 77 - 310);
    }

    @Test
    void excludedDaysAreListedDateAscending() {
        assertThat(ExpenditureExplainer.explain(input(true, true)).excludedDays()).containsExactly(
            new ExcludedIntakeDayJson(D0.plusDays(10), 500, "suspicious"),
            new ExcludedIntakeDayJson(D0.plusDays(20), 900, "marked"));
    }

    @Test
    void consecutiveGlycogenJumpsCollapseIntoOneWaterEvent() {
        assertThat(ExpenditureExplainer.explain(input(true, true)).waterEvents()).containsExactly(
            new WaterEvent(D0.plusDays(40), new BigDecimal("1.00")),
            new WaterEvent(D0.plusDays(60), new BigDecimal("1.50")));
    }

    @Test
    void theSeriesIsTheLast56DaysWithStatusWeightAndTrend() {
        List<SeriesPoint> series = ExpenditureExplainer.explain(input(true, true)).series();

        assertThat(series).hasSize(56);
        assertThat(series.get(0).date()).isEqualTo(D0.plusDays(14));
        assertThat(series.get(55).date()).isEqualTo(D0.plusDays(69));
        SeriesPoint marked = series.get(6); // day 20
        assertThat(marked.status()).isEqualTo("marked");
        assertThat(marked.intakeKcal()).isEqualTo(900);
        assertThat(marked.weightKg()).isNull(); // 20 − 7 is odd
        SeriesPoint d41 = series.get(27); // day 41: weigh-in, glycogen 1.0
        assertThat(d41.status()).isEqualTo("usable");
        assertThat(d41.intakeKcal()).isEqualTo(2400);
        assertThat(d41.weightKg()).isEqualByComparingTo("80.59");
        assertThat(d41.tissueKg()).isEqualByComparingTo("79.66");
        assertThat(d41.trendKg()).isEqualByComparingTo("80.76"); // 79.66 + 0.1 + 1.0
    }

    @Test
    void noUsableDayMeansNoAverageIntakeAndNoSimpleBase() {
        ExpenditureExplanationJson x = ExpenditureExplainer.explain(input(false, true));

        assertThat(x.usableDays()).isZero();
        assertThat(x.dataStart()).isEqualTo(D0.plusDays(7)); // the first weigh-in precedes the first logged day
        assertThat(x.unloggedDays()).isEqualTo(61); // days 7–69 minus the two excluded
        assertThat(x.avgIntakeKcal()).isNull();
        assertThat(x.avgMovementKcal()).isNull();
        assertThat(x.simpleBaseKcal()).isNull();
        assertThat(x.tissueKcalPerDay()).isEqualTo(-77);
    }

    @Test
    void noTraceMeansNoTissueLineAndAnEmptyTrend() {
        ExpenditureExplanationJson x = ExpenditureExplainer.explain(input(true, false));

        assertThat(x.tissueRateKgPerWeek()).isNull();
        assertThat(x.tissueKcalPerDay()).isNull();
        assertThat(x.simpleBaseKcal()).isNull();
        assertThat(x.waterEvents()).isEmpty();
        assertThat(x.series()).hasSize(56).allSatisfy(p -> {
            assertThat(p.trendKg()).isNull();
            assertThat(p.tissueKg()).isNull();
        });
    }
}
