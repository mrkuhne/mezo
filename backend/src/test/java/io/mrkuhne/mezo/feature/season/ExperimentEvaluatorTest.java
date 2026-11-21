package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.season.service.ExperimentEvaluator;
import io.mrkuhne.mezo.feature.season.service.ExperimentEvaluator.Overlap;
import io.mrkuhne.mezo.feature.season.service.ExperimentEvaluator.Result;
import io.mrkuhne.mezo.feature.season.service.ExperimentEvaluator.Signal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Boop B6 Évad S4 (mezo-r36n9.16): the experiment verdict — honest about too few days and small shifts. */
class ExperimentEvaluatorTest {

    private static final LocalDate START = LocalDate.of(2026, 11, 2);

    /** {@code n} days of a series from {@code from}, value = base + i % 5 (day-to-day noise of five levels). */
    private static Map<LocalDate, Double> series(LocalDate from, int n, double base) {
        Map<LocalDate, Double> m = new LinkedHashMap<>();
        for (int i = 0; i < n; i++) {
            m.put(from.plusDays(i), base + (i % 5));
        }
        return m;
    }

    private static Map<String, Map<LocalDate, Double>> one(String key, Map<LocalDate, Double> s) {
        return Map.of(key, s);
    }

    private static Signal signal(Result r, String key) {
        return r.signals().stream().filter(s -> s.key().equals(key)).findFirst().orElseThrow();
    }

    @Test
    void tenOfFourteenMarkedIsEnough() {
        Result r = ExperimentEvaluator.evaluate(one("sleep_min", series(START.minusDays(14), 14, 420)),
            one("sleep_min", series(START, 14, 421)), 10, 14, List.of());

        assertThat(r.verdict()).isNotEqualTo("insufficient");
        assertThat(r.needDays()).isEqualTo(10);
    }

    @Test
    void nineIsInsufficient() {
        Result r = ExperimentEvaluator.evaluate(one("sleep_min", series(START.minusDays(14), 14, 420)),
            one("sleep_min", series(START, 14, 470)), 9, 14, List.of());

        assertThat(r.verdict()).isEqualTo("insufficient");
        // the signals are still there so the phone can show the table
        assertThat(signal(r, "sleep_min").nBefore()).isEqualTo(14);
        assertThat(signal(r, "sleep_min").after()).isNotNull();
    }

    @Test
    void smallShiftIsNotClear() {
        Result r = ExperimentEvaluator.evaluate(one("energy", series(START.minusDays(14), 14, 3)),
            one("energy", series(START, 14, 3.1)), 14, 14, List.of());

        Signal s = signal(r, "energy");
        assertThat(s.clear()).isFalse();
        assertThat(s.better()).isNull();
        assertThat(r.verdict()).isEqualTo("none");
    }

    @Test
    void clearShiftUpIsBetter() {
        Result r = ExperimentEvaluator.evaluate(one("hrv_ms", series(START.minusDays(14), 14, 40)),
            one("hrv_ms", series(START, 14, 50)), 12, 14, List.of());

        Signal s = signal(r, "hrv_ms");
        assertThat(s.clear()).isTrue();
        assertThat(s.better()).isTrue();
        assertThat(s.cliffsDelta()).isEqualTo(1.0);
        assertThat(s.before()).isEqualTo(40 + 26 / 14.0, org.assertj.core.data.Offset.offset(0.001));
        assertThat(r.verdict()).isEqualTo("clear");
    }

    @Test
    void restingHeartRateDownIsBetter() {
        Result r = ExperimentEvaluator.evaluate(one("resting_hr", series(START.minusDays(14), 14, 62)),
            one("resting_hr", series(START, 14, 55)), 14, 14, List.of());

        Signal s = signal(r, "resting_hr");
        assertThat(s.clear()).isTrue();
        assertThat(s.cliffsDelta()).isEqualTo(-1.0);
        assertThat(s.better()).isTrue();
    }

    @Test
    void fewerThanFiveDaysOnASideHasNoDelta() {
        Result r = ExperimentEvaluator.evaluate(one("mood", series(START.minusDays(14), 4, 2)),
            one("mood", series(START, 14, 5)), 14, 14, List.of());

        Signal s = signal(r, "mood");
        assertThat(s.cliffsDelta()).isNull();
        assertThat(s.clear()).isFalse();
        assertThat(r.verdict()).isEqualTo("none");
    }

    @Test
    void overlapsCarriedThrough() {
        List<Overlap> overlaps = List.of(new Overlap("mesocycle", START.plusDays(3), "Közben új edzésblokk indult"));

        Result r = ExperimentEvaluator.evaluate(Map.of(), Map.of(), 14, 14, overlaps);

        assertThat(r.overlaps()).containsExactlyElementsOf(overlaps);
        assertThat(r.verdict()).isEqualTo("none");
    }
}
