package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class EnergyCurveModelTest {

    @Test
    void curveHas19Points() {
        assertThat(EnergyCurveModel.hourly(70, null, null)).hasSize(19);
    }

    @Test
    void dipIsTheLowestBetweenNoonAndSix() {
        double[] c = EnergyCurveModel.hourly(70, null, null);
        double min = Double.MAX_VALUE;
        int at = -1;
        for (int i = 6; i <= 12; i++) { // 12:00 .. 18:00
            if (c[i] < min) { min = c[i]; at = i; }
        }
        assertThat(at + 6).isBetween(14, 15);
    }

    @Test
    void higherFormaRaisesTheCurve() {
        double[] lo = EnergyCurveModel.hourly(40, null, null);
        double[] hi = EnergyCurveModel.hourly(90, null, null);
        for (int i = 0; i < 19; i++) assertThat(hi[i]).isGreaterThan(lo[i]);
        assertThat(EnergyCurveModel.hourly(70, LocalTime.of(18, 0), LocalTime.of(14, 0))).hasSize(19);
    }
}
