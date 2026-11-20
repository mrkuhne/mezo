package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** The weekly grind decision (mezo-r36n9.115, closes mezo-s5sd4); gap 2 throughout. */
class GrindRuleTest {
    private static final int GAP = 2;

    @Test
    void testUnstyled_shouldGrind_whenRirAtLeastGapBelowStoredTarget() {
        assertThat(GrindRule.unstyled(1, 3, GAP)).isTrue();
        assertThat(GrindRule.unstyled(2, 3, GAP)).isFalse();
    }

    @Test
    void testUnstyled_shouldNeverGrind_whenTargetLowOrNull() {
        // the old unreachable case stays as it was for an unstyled run (byte-identical rule)
        assertThat(GrindRule.unstyled(0, 1, GAP)).isFalse();
        assertThat(GrindRule.unstyled(0, null, GAP)).isFalse();
    }

    @Test
    void testStyled_shouldGrindByGap_whenEffectiveReserveHigh() {
        assertThat(GrindRule.styled(1, 8, 10, 3, GAP)).isTrue();
        assertThat(GrindRule.styled(2, 6, 10, 3, GAP)).isFalse(); // reps short does not count above reserve 1
        assertThat(GrindRule.styled(0, 10, 10, 2, GAP)).isTrue();
    }

    @Test
    void testStyled_shouldGrind_whenEffectiveAtMostOneAndRepsTwoShort() {
        assertThat(GrindRule.styled(0, 8, 10, 1, GAP)).isTrue();
        assertThat(GrindRule.styled(1, 7, 10, 0, GAP)).isTrue();
    }

    @Test
    void testStyled_shouldNotGrind_whenEffectiveAtMostOneAndRepsOneShort() {
        assertThat(GrindRule.styled(0, 9, 10, 1, GAP)).isFalse();
        assertThat(GrindRule.styled(0, 10, 10, 0, GAP)).isFalse();
    }

    @Test
    void testStyled_shouldSkipTheRepsBranch_whenTargetRepsNull() {
        assertThat(GrindRule.styled(0, 3, null, 1, GAP)).isFalse();
    }
}
