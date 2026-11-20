package io.mrkuhne.mezo.feature.penz.service.proposal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter.Split;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;

/** The split rules (mezo-r36n9.105, build notes call 11). Figures are invented; 1 Ft = 100 minor. */
class PenzProposalSplitterTest {

    private static final long FT = 100L;

    @Test
    void testSplit_shouldGive40And60_whenTheEmergencyFundIsFull() {
        Split s = ProposalSplitter.split(1_000_000 * FT, 6, 300_000 * FT, 2_000_000 * FT);
        assertThat(s.emergencyTargetMinor()).isEqualTo(1_800_000 * FT);
        assertThat(s.shortfallMinor()).isZero();
        assertThat(s.shortMinor()).isZero();
        assertThat(s.midMinor()).isEqualTo(400_000 * FT);
        assertThat(s.longMinor()).isEqualTo(600_000 * FT);
        assertThat(s.sharePct(Sleeve.MID)).isEqualByComparingTo("40.0");
    }

    @Test
    void testSplit_shouldFillTheShortfallFirst_roundedDown() {
        // target 6 × 300 000 = 1 800 000; short holds 1 549 500 → shortfall 250 500 → 250 000
        Split s = ProposalSplitter.split(1_000_000 * FT, 6, 300_000 * FT, 1_549_500 * FT);
        assertThat(s.shortfallMinor()).isEqualTo(250_500 * FT);
        assertThat(s.shortMinor()).isEqualTo(250_000 * FT);
        assertThat(s.midMinor()).isEqualTo(300_000 * FT);
        assertThat(s.longMinor()).isEqualTo(450_000 * FT);
    }

    @Test
    void testSplit_shouldPutEverythingShort_whenTheShortfallExceedsTheAmount() {
        Split s = ProposalSplitter.split(500_500 * FT, 6, 300_000 * FT, 0);
        assertThat(s.shortMinor()).isEqualTo(500_000 * FT);
        assertThat(s.midMinor()).isZero();
        assertThat(s.longMinor()).isEqualTo(500 * FT);
    }

    @Test
    void testSplit_shouldSendEveryRoundingRestToLong() {
        Split s = ProposalSplitter.split(1_234_567 * FT + 89, 6, null, 0);
        assertThat(s.midMinor()).isEqualTo(493_000 * FT);
        assertThat(s.longMinor()).isEqualTo(741_567 * FT + 89);
        assertThat(s.shortMinor() + s.midMinor() + s.longMinor()).isEqualTo(s.amountMinor());
    }

    @Test
    void testSplit_shouldHaveNoTarget_whenFixedCostsAreUnknownOrZero() {
        assertThat(ProposalSplitter.split(100_000 * FT, 6, null, 0).emergencyTargetMinor()).isZero();
        assertThat(ProposalSplitter.split(100_000 * FT, 6, 0L, 0).shortMinor()).isZero();
        assertThat(ProposalSplitter.split(100_000 * FT, 6, -5L, 0).targetKnown()).isFalse();
    }

    @Test
    void testSplit_shouldRefuse_whenTheAmountIsNotPositive() {
        assertThatThrownBy(() -> ProposalSplitter.split(0, 6, null, 0)).isInstanceOf(SystemRuntimeErrorException.class);
    }
}
