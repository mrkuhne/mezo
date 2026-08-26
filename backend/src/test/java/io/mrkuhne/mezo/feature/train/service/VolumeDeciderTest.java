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
        return tiered(week, prev, deload, logged, grind, 20); // legacy = emphasize semantics
    }
    private Input tiered(int week, int prev, boolean deload, int logged, boolean grind, int rampCeiling) {
        return new Input(week, prev, 8, 14, 20, deload, logged, grind, 2, HALF, rampCeiling);
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
    @Test void growTier_clampsRampAtItsCeiling() {
        Result r = VolumeDecider.decide(tiered(3, 13, false, 13, false, 14));
        assertThat(r.lever()).isEqualTo(Lever.RAMP); assertThat(r.targetSets()).isEqualTo(14); // 13+2 clamped to MAV
    }
    @Test void growTier_atCeiling_holds() {
        Result r = VolumeDecider.decide(tiered(4, 14, false, 14, false, 14));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(14);
    }
    // Maintain's ceiling IS mev (8 here) — at the ceiling, RAMP's prevSets<rampCeiling guard
    // is false, so it HOLDs, same as any other tier sitting at its own ceiling.
    @Test void maintainTier_atCeiling_holds() {
        Result r = VolumeDecider.decide(tiered(3, 8, false, 8, false, 8));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(8);
    }
    @Test void maintainTier_midCycleSwitch_holdsAboveCeilingWithoutCutting() {
        Result r = VolumeDecider.decide(tiered(4, 12, false, 12, false, 8));
        assertThat(r.lever()).isEqualTo(Lever.HOLD); assertThat(r.targetSets()).isEqualTo(12); // AD2 / GD7
    }
    // Below-ceiling maintain (post-deload, e.g. prev=4 after a DELOAD week) recovers back
    // toward MEV exactly like any other tier ramps toward its own ceiling — RAMP fires
    // because targetHit && !grind && prevSets(4) < rampCeiling(8); target = min(4+2, 8) = 6.
    // Ceiling alone encodes maintain semantics — there is no separate rampEnabled gate
    // (mezo-3m5m final review, fix 3: a maintain muscle deloaded to ~mev/2 must recover to
    // MEV afterward, not HOLD there forever).
    @Test void maintainTier_recoversTowardMevAfterDeload() {
        Result r = VolumeDecider.decide(tiered(4, 4, false, 4, false, 8));
        assertThat(r.lever()).isEqualTo(Lever.RAMP); assertThat(r.targetSets()).isEqualTo(6); // min(4+2, 8)
    }
    @Test void earlyDeload_stillDetectsAtRawMrv_regardlessOfTier() {
        Result r = VolumeDecider.decide(tiered(4, 20, false, 20, true, 14)); // prev>=mrv && grind
        assertThat(r.lever()).isEqualTo(Lever.DELOAD);
    }
}
