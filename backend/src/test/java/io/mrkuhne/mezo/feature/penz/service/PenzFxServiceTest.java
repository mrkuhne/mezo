package io.mrkuhne.mezo.feature.penz.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

/** The booking rate's rounding (mezo-r36n9.102): amount × rate, HALF_UP to a whole minor unit. */
class PenzFxServiceTest {

    @Test
    void roundsHalfUpToAWholeMinorUnit() {
        assertThat(PenzFxService.toHufMinor(1_250L, new BigDecimal("385.27"))).isEqualTo(481_588L); // .875 up
        assertThat(PenzFxService.toHufMinor(1L, new BigDecimal("0.5"))).isEqualTo(1L);
        assertThat(PenzFxService.toHufMinor(1L, new BigDecimal("0.49999999"))).isZero();
        assertThat(PenzFxService.toHufMinor(10_000L, new BigDecimal("331.5"))).isEqualTo(3_315_000L);
    }
}
