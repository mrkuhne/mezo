package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Boop Sport S2 (mezo-r36n9.202): session-RPE × minutes for both layers, unknown → null. */
class SportLoadRuleTest {

    @Test
    void sportIsRpeTimesMinutes() {
        assertThat(SportLoadRule.sport(new BigDecimal("7.5"), null, 90)).isEqualTo(675);
        assertThat(SportLoadRule.sport(null, 6, 60)).isEqualTo(360); // intensity stands in for a missing RPE
    }

    @Test
    void sportWithoutEffortOrDurationIsUnknown() {
        assertThat(SportLoadRule.sport(null, null, 90)).isNull();
        assertThat(SportLoadRule.sport(new BigDecimal("7"), null, null)).isNull();
        assertThat(SportLoadRule.sport(new BigDecimal("7"), null, 0)).isNull();
    }

    @Test
    void gymSessionRpeIsTheMeanOfTenMinusRir() {
        assertThat(SportLoadRule.gymSessionRpe(List.of(2, 1, 3))).isEqualByComparingTo("8"); // 8, 9, 7
        assertThat(SportLoadRule.gymSessionRpe(Arrays.asList(0, null, 12))).isEqualByComparingTo("5.5"); // 10, 1
        assertThat(SportLoadRule.gymSessionRpe(Arrays.asList(null, null))).isNull();
        assertThat(SportLoadRule.gymSessionRpe(List.of())).isNull();
    }

    @Test
    void gymLoadIsSessionRpeTimesMinutes() {
        assertThat(SportLoadRule.gym(new BigDecimal("8"), 60)).isEqualTo(480);
        assertThat(SportLoadRule.gym(new BigDecimal("7.33"), 45)).isEqualTo(330); // 329.85 → 330
        assertThat(SportLoadRule.gym(null, 60)).isNull();
        assertThat(SportLoadRule.gym(new BigDecimal("8"), 0)).isNull();
    }
}
