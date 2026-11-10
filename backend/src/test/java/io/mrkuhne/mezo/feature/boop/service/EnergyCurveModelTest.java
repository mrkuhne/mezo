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

    private static final org.assertj.core.data.Offset<Double> EPS = org.assertj.core.data.Offset.offset(1e-9);

    @Test
    void anchorsAtUnknownFormaScaleBy08() {
        double[] c = EnergyCurveModel.hourly(null, null, null);
        assertThat(c[0]).isCloseTo(0.35 * 0.8, EPS);   // 06:00
        assertThat(c[4]).isCloseTo(0.82 * 0.8, EPS);   // 10:00
        assertThat(c[8]).isCloseTo(0.38 * 0.8, EPS);   // 14:00
        assertThat(c[18]).isCloseTo(0.20 * 0.8, EPS);  // 24:00
    }

    @Test
    void formaScalesBetween06And10() {
        assertThat(EnergyCurveModel.hourly(0, null, null)[4]).isCloseTo(0.82 * 0.6, EPS);
        assertThat(EnergyCurveModel.hourly(100, null, null)[4]).isCloseTo(0.82, EPS);
    }

    @Test
    void lateLunchDeepensTheDipByExactly005() {
        double[] early = EnergyCurveModel.hourly(70, null, LocalTime.of(12, 0));
        double[] late = EnergyCurveModel.hourly(70, null, LocalTime.of(14, 0));
        for (int i = 0; i < 19; i++) {
            double expected = (i == 8 || i == 9) ? -0.05 : 0.0;
            assertThat(late[i] - early[i]).isCloseTo(expected, EPS);
        }
    }

    @Test
    void sessionAddsBoostThenTwoHourDip() {
        double[] none = EnergyCurveModel.hourly(70, null, null);
        double[] with = EnergyCurveModel.hourly(70, LocalTime.of(17, 0), null);
        for (int i = 0; i < 19; i++) {
            double expected = i == 11 ? 0.06 : (i == 12 || i == 13) ? -0.08 : 0.0; // 17, 18, 19
            assertThat(with[i] - none[i]).isCloseTo(expected, EPS);
        }
    }
}
