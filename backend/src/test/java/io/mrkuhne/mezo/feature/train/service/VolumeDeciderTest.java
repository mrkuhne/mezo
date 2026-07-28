package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Input;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Result;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class VolumeDeciderTest {
    private static final BigDecimal HALF = new BigDecimal("0.5");
    private Input in(int week, int prev, boolean deload, int logged, boolean grind) {
        return new Input(week, prev, 8, 14, 20, deload, logged, grind, 2, HALF);
    }
    @Test void week1_startsAtMev() {
        Result r = VolumeDecider.decide(in(1, 0, false, 0, false));
        assertThat(r.lever()).isEqualTo(Lever.START); assertThat(r.targetSets()).isEqualTo(8);
    }
    @Test void productiveWeek_rampsByStep() {
        Result r = VolumeDecider.decide(in(3, 14, false, 14, false));  // hit target, no grind, below mrv
        assertThat(r.lever()).isEqualTo(Lever.RAMP); assertThat(r.targetSets()).isEqualTo(16);
    }
    @Test void atMrv_holds() {
        Result r = VolumeDecider.decide(in(5, 20, false, 20, false));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(20);
    }
    @Test void missedTarget_holds() {
        Result r = VolumeDecider.decide(in(3, 14, false, 10, false)); // logged < prev → not productive
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(14);
    }
    @Test void deloadPhase_cutsToFraction() {
        Result r = VolumeDecider.decide(in(6, 18, true, 18, false));
        assertThat(r.lever()).isEqualTo(Lever.DELOAD); assertThat(r.targetSets()).isEqualTo(9); // round(18*0.5)
    }
    @Test void atMrvAndGrind_earlyDeloads() {
        Result r = VolumeDecider.decide(in(5, 20, false, 20, true));
        assertThat(r.lever()).isEqualTo(Lever.DELOAD); assertThat(r.targetSets()).isEqualTo(10);
    }
}
