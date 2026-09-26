package io.mrkuhne.mezo.feature.companion.reflection.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Pure math — no Spring, no clock: every date is anchored explicitly (midnight-safe). */
class EffectLinkCalculatorTest {

    private static final LocalDate D0 = LocalDate.of(2026, 9, 1);

    /** subjectCount days at subjectValue, complementCount days at complementValue. */
    private static Object[] fixture(int subjectCount, double subjectValue,
                                    int complementCount, double complementValue) {
        Set<LocalDate> subjectDays = new HashSet<>();
        Map<LocalDate, Double> series = new HashMap<>();
        for (int i = 0; i < subjectCount; i++) {
            subjectDays.add(D0.plusDays(i));
            series.put(D0.plusDays(i), subjectValue);
        }
        for (int i = 0; i < complementCount; i++) {
            series.put(D0.plusDays(subjectCount + i), complementValue);
        }
        return new Object[] {subjectDays, series};
    }

    @Test
    void clearPositiveDifferenceIsStrongBand() {
        Object[] f = fixture(8, 8.0, 12, 5.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(1.0); // every subject day beats every other
        assertThat(effect.meanDiff()).isEqualTo(3.0);
        assertThat(effect.strengthBand()).isEqualTo("eros");
        assertThat(effect.confidenceTier()).isEqualTo("kozepes"); // 8 subject days
        assertThat(effect.subjectDays()).isEqualTo(8);
        assertThat(effect.complementDays()).isEqualTo(12);
    }

    @Test
    void clearNegativeDifferenceHasNegativeDelta() {
        Object[] f = fixture(6, 3.0, 15, 7.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(-1.0);
        assertThat(effect.meanDiff()).isEqualTo(-4.0);
        assertThat(effect.confidenceTier()).isEqualTo("gyenge"); // 6 subject days
    }

    @Test
    void tiesCountAsZeroInDelta() {
        // 5 subject days at 6.0 vs 10 complement days at 6.0 → delta 0 → negligible → empty
        Object[] f = fixture(5, 6.0, 10, 6.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        assertThat(EffectLinkCalculator.compute(subject, series)).isEmpty();
    }

    @Test
    void belowSubjectGateIsEmpty() {
        Object[] f = fixture(4, 9.0, 20, 4.0); // 4 < MIN_SUBJECT_DAYS
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        assertThat(EffectLinkCalculator.compute(subject, series)).isEmpty();
    }

    @Test
    void belowComplementGateIsEmpty() {
        Object[] f = fixture(6, 9.0, 9, 4.0); // 9 < MIN_COMPLEMENT_DAYS
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        assertThat(EffectLinkCalculator.compute(subject, series)).isEmpty();
    }

    @Test
    void subjectDayWithoutMetricIsNotADataPoint() {
        Object[] f = fixture(5, 8.0, 10, 5.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        subject.add(D0.plusDays(100)); // a subject day with NO metric value
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.subjectDays()).isEqualTo(5); // the metric-less day never counted
    }

    @Test
    void clearSeparationLandsInStrongBand() {
        // subject: 5,6,6,7,7,8 (6 days) vs complement: 4,5,5,6,6,6,7,4,5,6 (10 days)
        // hand-computed: 40 wins, 7 losses of 60 pairs → delta = 33/60 = 0.55 → "eros"
        Set<LocalDate> subject = new HashSet<>();
        Map<LocalDate, Double> series = new HashMap<>();
        double[] subjectVals = {5, 6, 6, 7, 7, 8};
        double[] complementVals = {4, 5, 5, 6, 6, 6, 7, 4, 5, 6};
        for (int i = 0; i < subjectVals.length; i++) {
            subject.add(D0.plusDays(i));
            series.put(D0.plusDays(i), subjectVals[i]);
        }
        for (int i = 0; i < complementVals.length; i++) {
            series.put(D0.plusDays(50 + i), complementVals[i]);
        }
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(0.55);
        assertThat(effect.strengthBand()).isEqualTo("eros");
    }

    @Test
    void bandBoundaryEnyhe() {
        // subject: 5,6,6,6,7 (5 days) vs complement: 4,5,5,5,6,6,6,6,7,8 (10 days)
        // hand-computed: 21 wins, 13 losses of 50 pairs → delta = 8/50 = 0.16 ∈ [0.147, 0.33)
        Set<LocalDate> subject = new HashSet<>();
        Map<LocalDate, Double> series = new HashMap<>();
        double[] subjectVals = {5, 6, 6, 6, 7};
        double[] complementVals = {4, 5, 5, 5, 6, 6, 6, 6, 7, 8};
        for (int i = 0; i < subjectVals.length; i++) {
            subject.add(D0.plusDays(i));
            series.put(D0.plusDays(i), subjectVals[i]);
        }
        for (int i = 0; i < complementVals.length; i++) {
            series.put(D0.plusDays(50 + i), complementVals[i]);
        }
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(0.16);
        assertThat(effect.strengthBand()).isEqualTo("enyhe");
    }

    @Test
    void bandBoundaryKozepes() {
        // subject: 6,6,6,7,7 (5 days) vs complement: 5,5,5,6,6,6,6,6,7,8 (10 days)
        // hand-computed: 25 wins, 8 losses of 50 pairs → delta = 17/50 = 0.34 ∈ [0.33, 0.474)
        Set<LocalDate> subject = new HashSet<>();
        Map<LocalDate, Double> series = new HashMap<>();
        double[] subjectVals = {6, 6, 6, 7, 7};
        double[] complementVals = {5, 5, 5, 6, 6, 6, 6, 6, 7, 8};
        for (int i = 0; i < subjectVals.length; i++) {
            subject.add(D0.plusDays(i));
            series.put(D0.plusDays(i), subjectVals[i]);
        }
        for (int i = 0; i < complementVals.length; i++) {
            series.put(D0.plusDays(50 + i), complementVals[i]);
        }
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.cliffsDelta()).isEqualTo(0.34);
        assertThat(effect.strengthBand()).isEqualTo("kozepes");
    }

    @Test
    void tierBoundaryMedium() {
        // 8 subject days at 8.0 vs 10 complement days at 5.0
        // delta = 1.0 → "eros" band; subjectDays == 8 → "kozepes" tier (MIN_TIER_MEDIUM)
        Object[] f = fixture(8, 8.0, 10, 5.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.subjectDays()).isEqualTo(8);
        assertThat(effect.confidenceTier()).isEqualTo("kozepes");
    }

    @Test
    void tierBoundaryStrong() {
        // 16 subject days at 8.0 vs 10 complement days at 5.0
        // delta = 1.0 → "eros" band; subjectDays == 16 → "eros" tier (MIN_TIER_STRONG)
        Object[] f = fixture(16, 8.0, 10, 5.0);
        @SuppressWarnings("unchecked") var subject = (Set<LocalDate>) f[0];
        @SuppressWarnings("unchecked") var series = (Map<LocalDate, Double>) f[1];
        var effect = EffectLinkCalculator.compute(subject, series).orElseThrow();
        assertThat(effect.subjectDays()).isEqualTo(16);
        assertThat(effect.confidenceTier()).isEqualTo("eros");
    }
}
