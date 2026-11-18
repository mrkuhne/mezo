package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SetSlotsTest {

    private static SetSlots.Slot slot(int dayIndex, int sets) {
        return new SetSlots.Slot(UUID.randomUUID(), dayIndex, sets);
    }

    @Test void upGoesToTheFewestSetsThenTheLighterDay() {
        var a = slot(0, 4); var b = slot(0, 2); var c = slot(3, 2);        // Monday 4+2, Thursday 2
        assertThat(SetSlots.pickUp(List.of(a, b, c), 5, 8)).contains(c.exerciseId());
    }

    @Test void upSkipsAnExerciseAtFive() {
        var a = slot(0, 5); var b = slot(3, 3);
        assertThat(SetSlots.pickUp(List.of(a, b), 5, 8)).contains(b.exerciseId());
    }

    @Test void upSkipsADayAtEight() {
        var a = slot(0, 4); var b = slot(0, 4); var c = slot(3, 5);
        assertThat(SetSlots.pickUp(List.of(a, b, c), 5, 8)).isEmpty();       // Monday full, c at the exercise cap
    }

    @Test void upTiesOnSetsAndDayTotalFallToListOrder() {
        var a = slot(0, 2); var b = slot(3, 2);
        assertThat(SetSlots.pickUp(List.of(a, b), 5, 8)).contains(a.exerciseId());
        assertThat(SetSlots.pickUp(List.of(b, a), 5, 8)).contains(b.exerciseId());
    }

    @Test void downTakesFromTheMostSets() {
        var a = slot(0, 4); var b = slot(3, 2);
        assertThat(SetSlots.pickDown(List.of(a, b))).contains(a.exerciseId());
    }

    @Test void downNeverEmptiesAnExercise() {
        assertThat(SetSlots.pickDown(List.of(slot(0, 1)))).isEmpty();
    }

    @Test void downTiesFallToListOrder() {
        var a = slot(0, 3); var b = slot(3, 3);
        assertThat(SetSlots.pickDown(List.of(a, b))).contains(a.exerciseId());
        assertThat(SetSlots.pickDown(List.of(b, a))).contains(b.exerciseId());
    }

    /** A technique/challenge row weighs one extra set against the caps (mezo-r36n9.80, spec §6.4). */
    @Test void capWeightTwoBlocksTheExtraSet() {
        // exercise cap: 4 sets with the technique set weighing 2 = 5 -> full; the plain 3-set row takes it
        var tech = SetSlots.Slot.of(UUID.randomUUID(), 0, 4, 1);
        var plain = slot(3, 4);
        assertThat(tech.capWeight()).isEqualTo(5);
        assertThat(SetSlots.pickUp(List.of(tech, plain), 5, 8)).contains(plain.exerciseId());
        // session cap: Monday 4 + 3 (one technique set) = 8 weighted -> the day is full, nothing fits
        var a = slot(0, 4);
        var b = SetSlots.Slot.of(UUID.randomUUID(), 0, 3, 1);
        assertThat(SetSlots.pickUp(List.of(a, b), 5, 8)).isEmpty();
        // the band still counts plain sets: pickDown takes from the 4, not the weighted 3 (=4)
        assertThat(SetSlots.pickDown(List.of(b, a))).contains(a.exerciseId());
    }

    @Test void unflaggedCapsUnchanged() {
        var a = slot(0, 4); var b = slot(0, 3);                                // 7 < 8, a below 5
        assertThat(a.capWeight()).isEqualTo(4);
        assertThat(SetSlots.Slot.of(a.exerciseId(), 0, 4, 0)).isEqualTo(a);
        assertThat(SetSlots.pickUp(List.of(a, b), 5, 8)).contains(b.exerciseId());
        assertThat(SetSlots.Slot.of(UUID.randomUUID(), 0, 0, 1).capWeight()).isZero();   // no set, no technique set
    }

    @Test void anEmptyGroupYieldsNothing() {
        assertThat(SetSlots.pickUp(List.of(), 5, 8)).isEmpty();
        assertThat(SetSlots.pickDown(List.of())).isEmpty();
    }
}
