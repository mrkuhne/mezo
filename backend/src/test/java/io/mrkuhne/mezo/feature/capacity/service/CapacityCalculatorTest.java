package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.CapacityInputs;
import org.junit.jupiter.api.Test;

class CapacityCalculatorTest {

    private static final CapacityProperties P = new CapacityProperties(true, new CapacityProperties.Verdict(0.6, 0.9, 1.0),
            1.25, 1.3, 90, 15, new CapacityProperties.Learning(14, 5), null, null, null, 2000);

    private static CapacityInputs inputs(Integer sleep, Integer need, Double hrv, Double hrvBase) {
        return new CapacityInputs(10, sleep, need, null, null, hrv, hrvBase, 0, null, false, null, null);
    }

    @Test
    void ordinaryDayReadsRendben() {
        var cap = CapacityCalculator.today(inputs(null, null, null, null), P);
        assertThat(cap.units()).isCloseTo(12.5, within(1e-9));
        assertThat(Verdicts.word(10 / cap.units(), P)).isEqualTo("rendben");
    }

    @Test
    void shortSleepLowersCapacity() {
        var cap = CapacityCalculator.today(inputs(360, 450, null, null), P);
        assertThat(cap.units()).isCloseTo(12.5 * 0.75, within(1e-9));
        var f = cap.factors().stream().filter(x -> x.key().equals("sleep")).findFirst().orElseThrow();
        assertThat(f.effect()).isEqualTo(-1);
        assertThat(f.valueText()).isEqualTo("6 ó 00 p · 90 perccel kevesebb a szokásosnál");
        assertThat(CapacityCalculator.today(inputs(400, 450, null, null), P).units())
                .isCloseTo(12.5 * 0.85, within(1e-9));
    }

    @Test
    void missingHrvAddsNoFactor() {
        assertThat(CapacityCalculator.today(inputs(null, null, 30.0, null), P).factors()).isEmpty();
        assertThat(CapacityCalculator.today(inputs(null, null, null, 50.0), P).factors()).isEmpty();
        var low = CapacityCalculator.today(inputs(null, null, 30.0, 50.0), P);
        assertThat(low.units()).isCloseTo(12.5 * 0.9, within(1e-9));
    }

    @Test
    void otherMultipliers() {
        var in = new CapacityInputs(10, null, null, 66, 60.0, null, null, 14, true, true, 9, null);
        var cap = CapacityCalculator.today(in, P);
        assertThat(cap.units()).isCloseTo(12.5 * 0.85 * 0.9 * 0.93 * 0.6 * 1.05, within(1e-9));
        assertThat(cap.factors()).extracting(CapacityCalculator.Factor::key)
                .containsExactly("rhr", "yesterday", "fuel", "recovery", "checkin");
    }
}
