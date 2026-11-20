package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.season.service.SleepNeedRule;
import org.junit.jupiter.api.Test;

/** Boop B6 Évad (mezo-r36n9.16): the season's sleep need from the weekly training load, and the bedtime. */
class SleepNeedRuleTest {

    @Test
    void needAddsSixMinutesPerWeeklySession() {
        assertThat(SleepNeedRule.sleepNeedMinutes(450, 4, 2)).isEqualTo(486);
    }

    @Test
    void needIsCappedAtEightAndAHalfHours() {
        assertThat(SleepNeedRule.sleepNeedMinutes(480, 6, 3)).isEqualTo(510);
    }

    @Test
    void baseIsTheSleepGoalWhenSetElseSevenAndAHalfHours() {
        assertThat(SleepNeedRule.base(null)).isEqualTo(450);
        assertThat(SleepNeedRule.base(470)).isEqualTo(470);
    }

    @Test
    void wakeAnchorBedtimeIsNeedAndFallingAsleepBeforeWaking() {
        assertThat(SleepNeedRule.bedtime("WAKE", "06:30", 486)).isEqualTo("22:09");
    }

    @Test
    void bedAnchorBedtimeIsTheAnchor() {
        assertThat(SleepNeedRule.bedtime("BED", "22:45", 486)).isEqualTo("22:45");
    }

    @Test
    void wakeAnchorWrapsPastMidnight() {
        assertThat(SleepNeedRule.bedtime("WAKE", "05:00", 300)).isEqualTo("23:45");
    }
}
