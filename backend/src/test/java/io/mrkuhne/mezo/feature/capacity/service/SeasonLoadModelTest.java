package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadModel.DayRecovery;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadModel.WeekIn;
import io.mrkuhne.mezo.feature.capacity.service.SeasonLoadModel.WeekOut;
import java.util.List;
import java.util.Collections;
import org.junit.jupiter.api.Test;

class SeasonLoadModelTest {

    @Test
    void overWhenLoadExceedsRecovery() {
        List<WeekOut> out = SeasonLoadModel.weeks(List.of(
            new WeekIn(1, 40.0, 42.0, false, false),
            new WeekIn(2, 50.0, 42.0, false, false)));

        assertThat(out.get(0).over()).isFalse();
        assertThat(out.get(1).over()).isTrue();
    }

    @Test
    void futureWeeksAreTrainingOnly() {
        List<WeekOut> out = SeasonLoadModel.weeks(List.of(new WeekIn(5, 12.0, null, true, true)));

        assertThat(out.get(0).planned()).isTrue();
        assertThat(out.get(0).trainingOnly()).isTrue();
        assertThat(out.get(0).recovery()).isNull();
        assertThat(out.get(0).over()).isFalse();
    }

    @Test
    void recoveryClampsSleepAndHeartRateFactors() {
        // slept far less than needed: clamped at 0.6; resting HR far above baseline: clamped at 0.85
        double low = SeasonLoadModel.dayRecovery(new DayRecovery(120, 450, 90, 60.0, 6.0));
        assertThat(low).isCloseTo(6.0 * 0.6 * 0.85, within(1e-9));
        // slept far more, resting HR far below baseline: clamped at 1.1 each
        double high = SeasonLoadModel.dayRecovery(new DayRecovery(900, 450, 40, 60.0, 6.0));
        assertThat(high).isCloseTo(6.0 * 1.1 * 1.1, within(1e-9));
        // nothing known: neutral
        assertThat(SeasonLoadModel.dayRecovery(new DayRecovery(null, null, null, null, 6.0))).isEqualTo(6.0);
    }

    @Test
    void weekRecoveryIsMeanTimesSeven() {
        List<DayRecovery> week = Collections.nCopies(7, new DayRecovery(null, null, null, null, 6.0));
        assertThat(SeasonLoadModel.weekRecovery(week)).isCloseTo(42.0, within(1e-9));
    }

    @Test
    void headlineNeedsThreeOverWeeksInARow() {
        List<WeekOut> three = SeasonLoadModel.weeks(List.of(
            new WeekIn(1, 50.0, 42.0, false, false), new WeekIn(2, 50.0, 42.0, false, false),
            new WeekIn(3, 50.0, 42.0, false, false), new WeekIn(4, 20.0, 42.0, false, false),
            new WeekIn(5, 10.0, null, true, true)));
        assertThat(SeasonLoadModel.headline(three, 4)).isEqualTo(SeasonLoadModel.HEADLINE);
        // week 4 is the current one: not completed, so weeks 1-3 count
        assertThat(SeasonLoadModel.headline(three, 5)).isNull(); // last three completed are 2,3,4 and 4 is not over

        List<WeekOut> broken = SeasonLoadModel.weeks(List.of(
            new WeekIn(1, 50.0, 42.0, false, false), new WeekIn(2, 30.0, 42.0, false, false),
            new WeekIn(3, 50.0, 42.0, false, false)));
        assertThat(SeasonLoadModel.headline(broken, 4)).isNull();
        assertThat(SeasonLoadModel.headline(broken.subList(0, 2), 3)).isNull();
    }
}
