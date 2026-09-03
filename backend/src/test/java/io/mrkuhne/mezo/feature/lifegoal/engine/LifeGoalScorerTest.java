package io.mrkuhne.mezo.feature.lifegoal.engine;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.lifegoal.entity.PillarRuleJson;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.Test;

class LifeGoalScorerTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 1);

    private static PillarRuleJson habitRule(String cmp, String threshold) {
        return new PillarRuleJson(new BigDecimal(threshold), cmp, 4, null, null, null, null, null, null, null);
    }

    // ---- habit ----

    @Test
    void habit_hit_on_good_side_of_gte_threshold() {
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("165")));
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("gte", "160"), DAY, w).status()).isEqualTo("hit");
    }

    @Test
    void habit_miss_on_bad_side_of_gte_threshold() {
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("155")));
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("gte", "160"), DAY, w).status()).isEqualTo("miss");
    }

    @Test
    void habit_hit_on_good_side_of_lte_threshold() {
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("10")));
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("lte", "20"), DAY, w).status()).isEqualTo("hit");
    }

    @Test
    void habit_miss_on_bad_side_of_lte_threshold() {
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("30")));
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("lte", "20"), DAY, w).status()).isEqualTo("miss");
    }

    @Test
    void habit_no_value_is_no_data_never_miss() {
        assertThat(LifeGoalScorer.scoreDay("habit", habitRule("gte", "160"), DAY, SignalWindow.of(Map.of()))
            .status()).isEqualTo("no_data");
    }

    @Test
    void habit_no_data_target_is_rounded_to_scale_three() {
        PillarDayScore s = LifeGoalScorer.scoreDay("habit", habitRule("gte", "160"), DAY, SignalWindow.of(Map.of()));
        assertThat(s.target()).isEqualByComparingTo("160");
        assertThat(s.target().scale()).isEqualTo(3);
    }

    // ---- average ----

    @Test
    void average_hit_on_good_side() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 0; i < 7; i++) vals.put(DAY.minusDays(i), new BigDecimal("165"));
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, 7, null, null, null, null, null, null);
        PillarDayScore s = LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(vals));
        assertThat(s.status()).isEqualTo("hit");
        assertThat(s.value()).isEqualByComparingTo("165");
    }

    @Test
    void average_within_ten_percent_is_partial() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 0; i < 7; i++) vals.put(DAY.minusDays(i), new BigDecimal("150")); // avg 150 vs ≥160 → 6.25% alatta
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, 7, null, null, null, null, null, null);
        assertThat(LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("partial");
    }

    @Test
    void average_beyond_ten_percent_is_miss() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 0; i < 7; i++) vals.put(DAY.minusDays(i), new BigDecimal("100")); // avg 100 vs ≥160 → 37.5% alatta
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, 7, null, null, null, null, null, null);
        assertThat(LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("miss");
    }

    @Test
    void average_no_values_in_window_is_no_data() {
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, 7, null, null, null, null, null, null);
        assertThat(LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(Map.of())).status()).isEqualTo("no_data");
    }

    @Test
    void average_no_data_target_is_rounded_to_scale_three() {
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, 7, null, null, null, null, null, null);
        PillarDayScore s = LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(Map.of()));
        assertThat(s.target()).isEqualByComparingTo("160");
        assertThat(s.target().scale()).isEqualTo(3);
    }

    @Test
    void average_default_window_is_seven_days() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 0; i < 7; i++) vals.put(DAY.minusDays(i), new BigDecimal("165"));
        vals.put(DAY.minusDays(10), new BigDecimal("0")); // kívül esik a 7 napos default ablakon, nem szabad számítani
        PillarRuleJson rule = new PillarRuleJson(new BigDecimal("160"), "gte", null, null, null, null, null, null, null, null);
        PillarDayScore s = LifeGoalScorer.scoreDay("average", rule, DAY, SignalWindow.of(vals));
        assertThat(s.value()).isEqualByComparingTo("165");
    }

    // ---- target ----

    @Test
    void target_hit_on_good_side_of_pace_line() {
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, new BigDecimal("0"),
            new BigDecimal("100"), DAY.minusDays(10), DAY.plusDays(10), "up", null);
        // expected(DAY) = 0 + 100×10/20 = 50
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("55")));
        PillarDayScore s = LifeGoalScorer.scoreDay("target", rule, DAY, w);
        assertThat(s.status()).isEqualTo("hit");
        assertThat(s.target()).isEqualByComparingTo("50");
    }

    @Test
    void target_miss_below_pace_line_when_direction_up() {
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, new BigDecimal("0"),
            new BigDecimal("100"), DAY.minusDays(10), DAY.plusDays(10), "up", null);
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("45")));
        assertThat(LifeGoalScorer.scoreDay("target", rule, DAY, w).status()).isEqualTo("miss");
    }

    @Test
    void target_hit_below_pace_line_when_direction_down() {
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, new BigDecimal("100"),
            new BigDecimal("0"), DAY.minusDays(10), DAY.plusDays(10), "down", null);
        // expected(DAY) = 100 + (0-100)×10/20 = 50; down irány → érték ≤ expected → hit
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("45")));
        assertThat(LifeGoalScorer.scoreDay("target", rule, DAY, w).status()).isEqualTo("hit");
    }

    @Test
    void target_total_le_zero_is_no_data() {
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, new BigDecimal("0"),
            new BigDecimal("100"), DAY, DAY, "up", null); // targetDate == startDate → total = 0
        SignalWindow w = SignalWindow.of(Map.of(DAY, new BigDecimal("55")));
        assertThat(LifeGoalScorer.scoreDay("target", rule, DAY, w).status()).isEqualTo("no_data");
    }

    @Test
    void target_no_daily_value_is_no_data() {
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, new BigDecimal("0"),
            new BigDecimal("100"), DAY.minusDays(10), DAY.plusDays(10), "up", null);
        assertThat(LifeGoalScorer.scoreDay("target", rule, DAY, SignalWindow.of(Map.of())).status()).isEqualTo("no_data");
    }

    // ---- baseline ----

    @Test
    void baseline_hit_strictly_better_than_median_direction_up() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 1; i <= 14; i++) vals.put(DAY.minusDays(i), new BigDecimal("5"));
        vals.put(DAY, new BigDecimal("6"));
        PillarRuleJson rule = new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14);
        PillarDayScore s = LifeGoalScorer.scoreDay("baseline", rule, DAY, SignalWindow.of(vals));
        assertThat(s.status()).isEqualTo("hit");
        assertThat(s.baseline()).isEqualByComparingTo("5");
    }

    @Test
    void baseline_miss_not_strictly_better_direction_up() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 1; i <= 14; i++) vals.put(DAY.minusDays(i), new BigDecimal("5"));
        vals.put(DAY, new BigDecimal("4"));
        PillarRuleJson rule = new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14);
        assertThat(LifeGoalScorer.scoreDay("baseline", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("miss");
    }

    @Test
    void baseline_under_min_data_days_is_no_data() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 1; i <= 13; i++) vals.put(DAY.minusDays(i), new BigDecimal("7")); // csak 13 adat-nap
        vals.put(DAY, new BigDecimal("8"));
        PillarRuleJson rule = new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14);
        assertThat(LifeGoalScorer.scoreDay("baseline", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("no_data");
    }

    @Test
    void baseline_no_daily_value_is_no_data_even_with_enough_history() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 1; i <= 14; i++) vals.put(DAY.minusDays(i), new BigDecimal("5"));
        PillarRuleJson rule = new PillarRuleJson(null, null, null, 28, null, null, null, null, "up", 14);
        assertThat(LifeGoalScorer.scoreDay("baseline", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("no_data");
    }

    @Test
    void baseline_default_window_and_min_data_days() {
        Map<LocalDate, BigDecimal> vals = new HashMap<>();
        for (int i = 1; i <= 14; i++) vals.put(DAY.minusDays(i), new BigDecimal("5")); // == default minDataDays(14)
        vals.put(DAY, new BigDecimal("6"));
        PillarRuleJson rule = new PillarRuleJson(null, null, null, null, null, null, null, null, "up", null);
        assertThat(LifeGoalScorer.scoreDay("baseline", rule, DAY, SignalWindow.of(vals)).status()).isEqualTo("hit");
    }

    // ---- linked ----

    private static final PillarRuleJson LINKED_RULE =
        new PillarRuleJson(null, null, null, null, null, null, null, null, null, null);

    @Test
    void linked_off_pace_is_partial_never_miss() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("90.0"));
        Map<LocalDate, BigDecimal> expected = Map.of(
            DAY.minusDays(1), new BigDecimal("88.1"),   // fogyó ütemvonal
            DAY, new BigDecimal("88.0"));               // trend 2 kg felette → nem hit
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("partial");
    }

    @Test
    void linked_hit_within_tolerance_on_losing_slope() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("88.2"));
        Map<LocalDate, BigDecimal> expected = Map.of(
            DAY.minusDays(1), new BigDecimal("88.1"), // fogyó ütemvonal (88.0 < 88.1)
            DAY, new BigDecimal("88.0"));
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("hit");
    }

    @Test
    void linked_hit_within_tolerance_on_gaining_slope() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("89.8"));
        Map<LocalDate, BigDecimal> expected = Map.of(
            DAY.minusDays(1), new BigDecimal("88.0"), // hízó/tartó ütemvonal (90.0 > 88.0)
            DAY, new BigDecimal("90.0"));
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("hit");
    }

    @Test
    void linked_no_trend_value_is_no_data() {
        Map<LocalDate, BigDecimal> expected = Map.of(DAY, new BigDecimal("88.0"));
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(Map.of(), expected));
        assertThat(s.status()).isEqualTo("no_data");
    }

    @Test
    void linked_no_target_for_day_is_no_data() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("90.0"));
        Map<LocalDate, BigDecimal> expected = Map.of(DAY.minusDays(1), new BigDecimal("88.0"));
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("no_data");
    }

    @Test
    void linked_single_target_day_hit_within_tolerance() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("88.2"));
        Map<LocalDate, BigDecimal> expected = Map.of(DAY, new BigDecimal("88.0"));
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("hit");
    }

    @Test
    void linked_single_target_day_partial_outside_tolerance() {
        Map<LocalDate, BigDecimal> trend = Map.of(DAY, new BigDecimal("89.0"));
        Map<LocalDate, BigDecimal> expected = Map.of(DAY, new BigDecimal("88.0"));
        PillarDayScore s = LifeGoalScorer.scoreDay("linked", LINKED_RULE, DAY, new SignalWindow(trend, expected));
        assertThat(s.status()).isEqualTo("partial");
    }

    // ---- unknown kind ----

    @Test
    void unknown_kind_is_no_data_not_exception() {
        PillarDayScore s = LifeGoalScorer.scoreDay("bogus", LINKED_RULE, DAY, SignalWindow.of(Map.of()));
        assertThat(s.status()).isEqualTo("no_data");
    }

    // ---- dailyPoint ----

    @Test
    void daily_point_weights_and_skips_no_data() {
        Double p = LifeGoalScorer.dailyPoint(List.of(
            new LifeGoalScorer.WeightedStatus(2, "hit"),
            new LifeGoalScorer.WeightedStatus(1, "miss"),
            new LifeGoalScorer.WeightedStatus(3, "no_data")));
        assertThat(p).isEqualTo(2.0 / 3.0, Offset.offset(1e-9));
    }

    @Test
    void daily_point_partial_counts_as_half() {
        Double p = LifeGoalScorer.dailyPoint(List.of(
            new LifeGoalScorer.WeightedStatus(1, "partial")));
        assertThat(p).isEqualTo(0.5, Offset.offset(1e-9));
    }

    @Test
    void all_no_data_daily_point_is_null() {
        assertThat(LifeGoalScorer.dailyPoint(List.of(new LifeGoalScorer.WeightedStatus(1, "no_data")))).isNull();
    }

    // ---- arrow ----

    @Test
    void arrow_insufficient_below_five_data_days_in_either_window() {
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 0; i < 7; i++) series.put(DAY.minusDays(i), 1.0); // rövid ablak ok, hosszú üres
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("insufficient");
    }

    @Test
    void arrow_up_at_plus_point_one() {
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 7; i < 28; i++) series.put(DAY.minusDays(i), 0.5);
        for (int i = 0; i < 7; i++) series.put(DAY.minusDays(i), 0.6);
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("up");
    }

    @Test
    void arrow_down_at_minus_point_one() {
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 7; i < 28; i++) series.put(DAY.minusDays(i), 0.5);
        for (int i = 0; i < 7; i++) series.put(DAY.minusDays(i), 0.4);
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("down");
    }

    @Test
    void arrow_flat_within_threshold() {
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 7; i < 28; i++) series.put(DAY.minusDays(i), 0.5);
        for (int i = 0; i < 7; i++) series.put(DAY.minusDays(i), 0.55);
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("flat");
    }

    @Test
    void arrow_exactly_five_data_days_per_window_is_sufficient() {
        Map<LocalDate, Double> series = new HashMap<>();
        // rövid ablak: 5 nap adat a 7-ből
        series.put(DAY, 0.6);
        series.put(DAY.minusDays(1), 0.6);
        series.put(DAY.minusDays(2), 0.6);
        series.put(DAY.minusDays(3), 0.6);
        series.put(DAY.minusDays(4), 0.6);
        // hosszú ablak: 5 nap adat a 21-ből
        series.put(DAY.minusDays(7), 0.5);
        series.put(DAY.minusDays(8), 0.5);
        series.put(DAY.minusDays(9), 0.5);
        series.put(DAY.minusDays(10), 0.5);
        series.put(DAY.minusDays(11), 0.5);
        assertThat(LifeGoalScorer.arrow(series, DAY)).isEqualTo("up");
    }
}
