package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;
import java.util.TreeMap;

/** A V3.1 felszínre-engedő kapu tiszta fixtúrái — illesztés, min-n, degeneráció (no Spring, no DB). */
class PatternGateTest {

    private static final LocalDate D = LocalDate.of(2026, 6, 1);

    private static Map<LocalDate, Double> series(LocalDate start, double... values) {
        Map<LocalDate, Double> out = new TreeMap<>();
        for (int i = 0; i < values.length; i++) {
            out.put(start.plusDays(i), values[i]);
        }
        return out;
    }

    @Test
    void testEvaluate_shouldReturnNoData_whenNoDayAligns() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3), series(D.plusDays(30), 4, 5, 6), 0, 8, 3,
                MetricValueKind.NUMBER);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.NO_DATA);
        assertThat(outcome.alignedDays()).isZero();
        assertThat(outcome.result()).isNull();
    }

    @Test
    void testEvaluate_shouldReturnFewDays_whenBelowMinN() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5), series(D, 2, 1, 4, 3, 6), 0, 8, 3,
                MetricValueKind.NUMBER);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.FEW_DAYS);
        assertThat(outcome.alignedDays()).isEqualTo(5);
        assertThat(outcome.result()).isNull();
    }

    @Test
    void testEvaluate_shouldReturnLive_whenMinNReached() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5, 6, 7, 8), series(D, 2, 4, 6, 8, 10, 12, 14, 16),
                0, 8, 3, MetricValueKind.NUMBER);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.LIVE);
        assertThat(outcome.alignedDays()).isEqualTo(8);
        assertThat(outcome.result().r()).isCloseTo(1.0, within(1e-9));
        assertThat(outcome.result().n()).isEqualTo(8);
    }

    @Test
    void testEvaluate_shouldReturnDegenerateNamingSideB_whenSecondSeriesConstant() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5, 6, 7, 8), series(D, 5, 5, 5, 5, 5, 5, 5, 5),
                0, 8, 3, MetricValueKind.NUMBER);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.DEGENERATE);
        assertThat(outcome.constantSide()).isEqualTo(PatternGate.Side.B);
        assertThat(outcome.alignedDays()).isEqualTo(8);
    }

    @Test
    void testEvaluate_shouldReturnDegenerateNamingBoth_whenBothSeriesConstant() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 2, 2, 2, 2, 2, 2, 2, 2), series(D, 5, 5, 5, 5, 5, 5, 5, 5),
                0, 8, 3, MetricValueKind.NUMBER);

        assertThat(outcome.constantSide()).isEqualTo(PatternGate.Side.BOTH);
    }

    @Test
    void testEvaluate_shouldAlignShiftedDays_whenLagIsOne() {
        // A: jún 1-5 = 1..5 · B: jún 2-6 = 2,4,6,8,10 → lag=1 mellett tökéletes egyezés
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5), series(D.plusDays(1), 2, 4, 6, 8, 10),
                1, 3, 3, MetricValueKind.NUMBER);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.LIVE);
        assertThat(outcome.alignedDays()).isEqualTo(5);
        assertThat(outcome.result().r()).isCloseTo(1.0, within(1e-9));
    }

    @Test
    void testEvaluate_shouldDropUnpairedDays_whenLagIsZeroOnShiftedSeries() {
        // ugyanaz az input lag=0-val: csak jún 2-5 illeszkedik (4 nap)
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 1, 2, 3, 4, 5), series(D.plusDays(1), 2, 4, 6, 8, 10),
                0, 3, 3, MetricValueKind.NUMBER);

        assertThat(outcome.alignedDays()).isEqualTo(4);
    }

    @Test
    void testEvaluate_shouldReturnImbalancedGroups_whenBinarySeriesHasEightAndOne() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 0, 0, 0, 0, 0, 0, 0, 0, 1),
                series(D, 12, 13, 14, 15, 16, 17, 18, 19, 20),
                0, 8, 3, MetricValueKind.BINARY);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.IMBALANCED_GROUPS);
        assertThat(outcome.groupZeroDays()).isEqualTo(8);
        assertThat(outcome.groupOneDays()).isEqualTo(1);
        assertThat(outcome.result()).isNull();
    }

    @Test
    void testEvaluate_shouldReturnLiveWithGroupCounts_whenBinarySeriesHasThreeAndThree() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 0, 0, 0, 1, 1, 1),
                series(D, 12, 13, 14, 18, 19, 20),
                0, 6, 3, MetricValueKind.BINARY);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.LIVE);
        assertThat(outcome.groupZeroDays()).isEqualTo(3);
        assertThat(outcome.groupOneDays()).isEqualTo(3);
        assertThat(outcome.result()).isNotNull();
    }

    @Test
    void testEvaluate_shouldNotApplyGroupGate_whenNumberSeriesHasOnlyTwoValues() {
        PatternGate.Outcome outcome = PatternGate.evaluate(
                series(D, 0, 0, 0, 0, 0, 0, 0, 1),
                series(D, 12, 13, 14, 15, 16, 17, 18, 20),
                0, 8, 3, MetricValueKind.NUMBER);

        assertThat(outcome.verdict()).isEqualTo(PatternGate.Verdict.LIVE);
        assertThat(outcome.groupZeroDays()).isNull();
        assertThat(outcome.groupOneDays()).isNull();
    }
}
