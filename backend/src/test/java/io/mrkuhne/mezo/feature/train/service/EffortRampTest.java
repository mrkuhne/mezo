package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.config.TrainStyleProperties;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class EffortRampTest {

    private static final TrainStyleProperties.Ramp CFG = new TrainStyleProperties.Ramp(1, 2, 2, 1);

    private static List<String> block(int weeks) {
        List<String> c = new ArrayList<>();
        for (int i = 0; i < weeks - 1; i++) c.add(i == 0 ? "MEV" : "MAV");
        c.add("Deload");
        return c;
    }

    private static List<Integer> run(int base, int weeks, boolean free) {
        List<String> c = block(weeks);
        List<Integer> out = new ArrayList<>();
        for (int w = 1; w <= weeks; w++) out.add(EffortRamp.effectiveReserve(base, w, c, free, CFG));
        return out;
    }

    @Test void fourWeekBlock() {
        assertThat(run(2, 4, false)).containsExactly(2, 1, 0, 4);
        assertThat(run(3, 4, false)).containsExactly(3, 2, 1, 5);
    }

    @Test void fiveWeekBlock() {
        assertThat(run(2, 5, false)).containsExactly(2, 2, 1, 0, 4);
        assertThat(run(3, 5, false)).containsExactly(3, 3, 2, 1, 5);
    }

    @Test void sixWeekBlock() {
        assertThat(run(2, 6, false)).containsExactly(2, 2, 1, 1, 0, 4);
        assertThat(run(3, 6, false)).containsExactly(3, 3, 2, 2, 1, 5);
    }

    @Test void eightWeekBlock() {
        assertThat(run(2, 8, false)).containsExactly(2, 2, 2, 1, 1, 1, 0, 4);
        assertThat(run(3, 8, false)).containsExactly(3, 3, 3, 2, 2, 2, 1, 5);
    }

    @Test void freeNeverBelowOne() {
        assertThat(run(2, 6, true)).containsExactly(2, 2, 1, 1, 1, 4);
        assertThat(run(0, 6, true)).containsExactly(1, 1, 1, 1, 1, 2);
    }

    @Test void alloutStaysZero() {
        assertThat(run(0, 6, false)).containsExactly(0, 0, 0, 0, 0, 2);
    }

    @Test void deloadAddsTwo() {
        assertThat(EffortRamp.effectiveReserve(1, 4, block(4), false, CFG)).isEqualTo(3);
    }

    @Test void noDeloadInCurve() {
        List<String> c = List.of("MEV", "MAV", "MAV", "MRV");
        List<Integer> out = new ArrayList<>();
        for (int w = 1; w <= 4; w++) out.add(EffortRamp.effectiveReserve(2, w, c, false, CFG));
        assertThat(out).containsExactly(2, 2, 1, 0);
    }

    @Test void deloadMatchIsCaseInsensitive() {
        assertThat(EffortRamp.effectiveReserve(2, 3, List.of("MEV", "MAV", "deload"), false, CFG)).isEqualTo(4);
    }

    @Test void weekOutsideCurveIsBase() {
        List<String> c = block(6);
        assertThat(EffortRamp.effectiveReserve(2, 0, c, false, CFG)).isEqualTo(2);
        assertThat(EffortRamp.effectiveReserve(2, 7, c, false, CFG)).isEqualTo(2);
        assertThat(EffortRamp.effectiveReserve(2, 3, null, false, CFG)).isEqualTo(2);
        assertThat(EffortRamp.effectiveReserve(2, 3, List.of(), false, CFG)).isEqualTo(2);
        assertThat(EffortRamp.effectiveReserve(0, 9, c, true, CFG)).isEqualTo(1);
    }
}
