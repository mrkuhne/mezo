package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * S4 (bd mezo-d58h.4, spec §5): "the LLM writes prose only and can never invent a number that
 * isn't in facts". Free prose has no index-selection seam like the refs idiom, so the guard is a
 * deterministic post-check: any numeral in the answer must occur in the grounding text.
 */
class ProseNumberGuardTest {

    private static final String GROUNDING =
        "Alvásadósság: 1,6 óra/éjszaka (cél 8,0 óra, 5 rögzített éjszaka 7-ből)";

    @Test
    void testGrounded_shouldAcceptNumberFreeProse() {
        assertThat(ProseNumberGuard.grounded(
            "Az elmúlt éjszakák rövidek voltak; ma este feküdj le korábban.", GROUNDING)).isTrue();
    }

    @Test
    void testGrounded_shouldAcceptANumberThatAppearsInTheGrounding() {
        assertThat(ProseNumberGuard.grounded(
            "Az adósság 1,6 óra éjszakánként.", GROUNDING)).isTrue();
    }

    /** The separator must not decide the verdict: the facts render with a Hungarian comma, a
     *  model may answer with a dot, and both mean the same number. */
    @Test
    void testGrounded_shouldNormaliseTheDecimalSeparator() {
        assertThat(ProseNumberGuard.grounded("Az adósság 1.6 óra.", GROUNDING)).isTrue();
    }

    @Test
    void testGrounded_shouldRejectAnInventedNumber() {
        assertThat(ProseNumberGuard.grounded(
            "Aludj ma 9,5 órát.", GROUNDING)).isFalse();
    }

    @Test
    void testGrounded_shouldTreatBlankOrNullProseAsUngrounded() {
        assertThat(ProseNumberGuard.grounded(null, GROUNDING)).isFalse();
        assertThat(ProseNumberGuard.grounded("   ", GROUNDING)).isFalse();
    }

    /** Regression: substring matching would incorrectly accept "6" because it appears within "1.6"
     *  after normalisation. The guard must use token-equality, not substring search. */
    @Test
    void testGrounded_shouldRejectSubstringMatches() {
        assertThat(ProseNumberGuard.grounded("Aludj 6 órát.", GROUNDING)).isFalse();
    }

    @Test
    void testGrounded_shouldAcceptValidNumbersRegression() {
        assertThat(ProseNumberGuard.grounded(
            "Az adósság 1,6 óra.", GROUNDING)).isTrue();
    }
}
