package io.mrkuhne.mezo.feature.train.service;

import static io.mrkuhne.mezo.feature.train.service.PriorityTier.EMPHASIZE;
import static io.mrkuhne.mezo.feature.train.service.PriorityTier.GROW;
import static io.mrkuhne.mezo.feature.train.service.PriorityTier.MAINTAIN;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever.DELOAD;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever.DOWN;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever.HOLD;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever.NONE;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Lever.UP;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.ALL_SETS_DONE;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.AT_CEILING;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.DEFICIT_PACE;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.GRIND;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.JOINT_PAIN;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.ROOM_IN_BAND;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.SETS_MISSED;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.SORENESS;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.TIER_MAINTAIN;
import static io.mrkuhne.mezo.feature.train.service.VolumeDecider.Reason.TOO_MUCH;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.VolumeBands.Band;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Input;
import io.mrkuhne.mezo.feature.train.service.VolumeDecider.Result;
import org.junit.jupiter.api.Test;

class VolumeDeciderTest {

    /** Fluent test builder: week 3, EMPHASIZE, band 14-22, planned = logged = 15, no flags, steps 2/1/1. */
    private static final class B {
        int week = 3;
        PriorityTier tier = EMPHASIZE;
        Band band = new Band(14, 22, 22, false);
        int planned = 15;
        int logged = 15;
        boolean grind;
        boolean tooMuch;
        boolean jointPain;
        boolean sorenessHigh;
        boolean deficit;
        boolean deloadPhase;

        B week(int v) { week = v; return this; }
        B tier(PriorityTier v) { tier = v; return this; }
        B band(Band v) { band = v; return this; }
        B planned(int v) { planned = v; logged = v; return this; }
        B logged(int v) { logged = v; return this; }
        B grind(boolean v) { grind = v; return this; }
        B tooMuch(boolean v) { tooMuch = v; return this; }
        B jointPain(boolean v) { jointPain = v; return this; }
        B sorenessHigh(boolean v) { sorenessHigh = v; return this; }
        B deficit(boolean v) { deficit = v; return this; }
        B deloadPhase(boolean v) { deloadPhase = v; return this; }

        Input build() {
            return new Input(week, tier, band, planned, logged, grind, tooMuch, jointPain, sorenessHigh,
                deficit, deloadPhase, 2, 1, 1);
        }
    }

    private static B in() { return new B(); }

    private static Result decide(B b) { return VolumeDecider.decide(b.build()); }

    @Test void weekOneLeavesThePlanAlone() { assertThat(decide(in().week(1)).lever()).isEqualTo(NONE); }
    @Test void deloadPhaseIsADeload() { assertThat(decide(in().deloadPhase(true)).lever()).isEqualTo(DELOAD); }

    @Test void maintainNeverMoves() {
        var r = decide(in().tier(MAINTAIN));
        assertThat(r.lever()).isEqualTo(HOLD);
        assertThat(r.reasons()).containsExactly(TIER_MAINTAIN);
    }

    @Test void atTheTopWithAGrindStepsDown() {
        var r = decide(in().planned(22).grind(true));
        assertThat(r.delta()).isEqualTo(-1);
        assertThat(r.lever()).isEqualTo(DOWN);
        assertThat(r.reasons()).containsExactly(GRIND);
    }

    @Test void atTheTopWithTooMuchStepsDown() {
        var r = decide(in().planned(22).tooMuch(true));
        assertThat(r.lever()).isEqualTo(DOWN);
        assertThat(r.delta()).isEqualTo(-1);
        assertThat(r.reasons()).containsExactly(TOO_MUCH);
    }

    @Test void grindBelowTheTopHolds() { assertThat(decide(in().planned(15).grind(true)).lever()).isEqualTo(HOLD); }

    @Test void tooMuchBelowTheTopHolds() {
        var r = decide(in().planned(15).tooMuch(true));
        assertThat(r.lever()).isEqualTo(HOLD);
        assertThat(r.reasons()).contains(TOO_MUCH);
    }

    @Test void severalHoldReasonsAreAllReported() {
        var r = decide(in().planned(15).logged(13).grind(true).tooMuch(true).jointPain(true).sorenessHigh(true));
        assertThat(r.lever()).isEqualTo(HOLD);
        assertThat(r.delta()).isZero();
        assertThat(r.reasons()).containsExactlyInAnyOrder(SETS_MISSED, GRIND, TOO_MUCH, JOINT_PAIN, SORENESS);
    }

    @Test void missedSetsHold() {
        var r = decide(in().planned(15).logged(13));
        assertThat(r.reasons()).contains(SETS_MISSED);
    }

    @Test void jointPainHolds() { assertThat(decide(in().jointPain(true)).reasons()).contains(JOINT_PAIN); }
    @Test void sorenessHolds() { assertThat(decide(in().sorenessHigh(true)).reasons()).contains(SORENESS); }

    @Test void emphasizeStepsTwo() {
        var r = decide(in().tier(EMPHASIZE).planned(15).logged(15));
        assertThat(r.lever()).isEqualTo(UP);
        assertThat(r.delta()).isEqualTo(2);
        assertThat(r.reasons()).containsExactly(ALL_SETS_DONE, ROOM_IN_BAND);
    }

    @Test void growStepsOne() {
        assertThat(decide(in().tier(GROW).band(new Band(10, 16, 22, false)).planned(12).logged(12)).delta()).isEqualTo(1);
    }

    @Test void deficitStepsOneEvenOnEmphasize() {
        var r = decide(in().tier(EMPHASIZE).planned(15).logged(15).deficit(true));
        assertThat(r.delta()).isEqualTo(1);
        assertThat(r.reasons()).contains(DEFICIT_PACE);
    }

    @Test void neverPastTheBandsTop() {
        assertThat(decide(in().tier(EMPHASIZE).planned(21).logged(21)).delta()).isEqualTo(1);
    }

    @Test void atTheTopHolds() {
        var r = decide(in().tier(EMPHASIZE).planned(22).logged(22));
        assertThat(r.lever()).isEqualTo(HOLD);
        assertThat(r.reasons()).contains(AT_CEILING);
    }

    @Test void aPlanAboveItsBandIsNotPulledBack() {
        assertThat(decide(in().tier(GROW).band(new Band(10, 16, 22, false)).planned(19).logged(19)).delta()).isZero();
    }

    @Test void stepPinsTheWeeklyValues() {
        assertThat(VolumeDecider.step(EMPHASIZE, false, 2, 1, 1)).isEqualTo(2);
        assertThat(VolumeDecider.step(GROW, false, 2, 1, 1)).isEqualTo(1);
        assertThat(VolumeDecider.step(EMPHASIZE, true, 2, 1, 1)).isEqualTo(1);
        assertThat(VolumeDecider.step(GROW, true, 2, 1, 3)).isEqualTo(3);
        assertThat(VolumeDecider.step(MAINTAIN, false, 2, 1, 1)).isZero();
        assertThat(VolumeDecider.step(MAINTAIN, true, 2, 1, 1)).isZero();
    }
}
