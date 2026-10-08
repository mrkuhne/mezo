package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import org.junit.jupiter.api.Test;

/** Kihagyás S3 review (I4/I2): the mode wording is goal-neutral and the unjudged rule matches the enum's. */
class FuelModeTextTest {

    private static FuelDayResponse day(FuelDayResponse.FuelModeEnum mode) {
        return new FuelDayResponse().fuelMode(mode);
    }

    @Test
    void suffix_shouldBeGoalNeutral_onAMaintenanceDay() {
        assertThat(FuelModeText.suffix(day(FuelDayResponse.FuelModeEnum.MAINTENANCE)))
            .isEqualTo(" (sérülés: nem kell kevesebbet enned; a fehérje a fő cél)")
            .doesNotContain("hiány").doesNotContain("szünetel");
    }

    @Test
    void isUnjudged_shouldBeTrueOnlyForGuidanceAndEstimate() {
        assertThat(FuelModeText.isUnjudged(day(FuelDayResponse.FuelModeEnum.GUIDANCE))).isTrue();
        assertThat(FuelModeText.isUnjudged(day(FuelDayResponse.FuelModeEnum.ESTIMATE))).isTrue();
        assertThat(FuelModeText.isUnjudged(day(FuelDayResponse.FuelModeEnum.MAINTENANCE))).isFalse();
        assertThat(FuelModeText.isUnjudged(day(null))).isFalse();
    }
}
