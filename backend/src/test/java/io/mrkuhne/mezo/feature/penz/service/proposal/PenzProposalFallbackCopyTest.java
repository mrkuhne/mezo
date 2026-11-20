package io.mrkuhne.mezo.feature.penz.service.proposal;

import static io.mrkuhne.mezo.feature.penz.service.proposal.ProposalFixtures.FT;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalFigures.Fact;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter.Split;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

/** The fixed copy passes the validator by construction, for every split shape (mezo-r36n9.105). */
class PenzProposalFallbackCopyTest {

    static List<Split> splits() {
        return List.of(
            ProposalFixtures.split(),                                              // shortfall filled first
            ProposalSplitter.split(1_000_000 * FT, 6, 300_000 * FT, 5_000_000 * FT), // fund full
            ProposalSplitter.split(1_234_567 * FT + 42, 6, null, 0),              // no fixed costs
            ProposalSplitter.split(500_500 * FT, 3, 300_000 * FT, 0),             // all short
            ProposalSplitter.split(1_000 * FT, 6, 0L, 0),                          // smallest amount
            ProposalSplitter.split(100_000 * FT, 6, 300_000 * FT, 1_799_500 * FT)); // shortfall rounds to 0
    }

    @ParameterizedTest
    @MethodSource("splits")
    void testNarration_shouldPassTheValidator_forEverySplitShape(Split split) {
        ProposalFigures figures = ProposalFixtures.figures(split, ProposalFixtures.CATALOG);
        assertThat(ProposalValidator.validate(ProposalFallbackCopy.narration(figures), figures,
            ProposalFixtures.CATALOG)).isEmpty();
    }

    @Test
    void testNarration_shouldPrintTheFigures() {
        ProposalNarration n = ProposalFallbackCopy.narration(ProposalFixtures.figures());
        assertThat(n.summary()).contains("*1 000 000 Ft*", "250 000 Ft", "300 000 Ft", "450 000 Ft");
        assertThat(n.why(Sleeve.SHORT)).contains("6 havi", "1 800 000 Ft", "250 500 Ft");
        assertThat(n.why(Sleeve.MID)).contains("40%");
        assertThat(n.why(Sleeve.LONG)).contains("60%");
    }

    @Test
    void testShortWhy_shouldNotPrintZeroFt_whenTheShortfallRoundsAway() {
        // shortfall 500 Ft: below the 1 000 Ft rounding step, so the short sleeve gets nothing
        Split s = ProposalSplitter.split(100_000 * FT, 6, 300_000 * FT, 1_799_500 * FT);
        assertThat(s.shortMinor()).isZero();
        String why = ProposalFallbackCopy.narration(ProposalFixtures.figures(s, ProposalFixtures.CATALOG))
            .why(Sleeve.SHORT);
        assertThat(why).contains("500 Ft").contains("ide most nem kerül pénz").doesNotContain(" 0 Ft");
    }

    @Test
    void testRules_shouldSayOnlyShortAndMidRoundDown_andTheRestGoesLong() {
        assertThat(ProposalFallbackCopy.rules(ProposalFixtures.split())).contains(
            "A rövid és a középtávú összeget lefelé kerekítem 1 000 Ft-ra; a kerekítésből maradó rész a hosszú "
                + "rekeszbe megy.");
    }

    @Test
    void testCardLinesAndRules_shouldBeComputedCopy() {
        Split s = ProposalFixtures.split();
        assertThat(ProposalFallbackCopy.title("lump_sum", s.amountMinor()))
            .isEqualTo("Felosztási javaslat: 1 000 000 Ft");
        assertThat(ProposalFallbackCopy.title("monthly", 37_000 * FT)).isEqualTo("Havi stratégia: 37 000 Ft");
        assertThat(ProposalFallbackCopy.sub(s)).isEqualTo("Rövid 250 000 Ft · Közép 300 000 Ft · Hosszú 450 000 Ft");
        assertThat(ProposalFallbackCopy.rules(s)).hasSize(5).first().asString().contains("6 havi", "1 800 000 Ft");
    }

    @Test
    void testFacts_shouldBeFormattedFromTheFigures() {
        assertThat(ProposalFixtures.figures().facts()).contains(
            new Fact("1 000 000", "Ft", "a felosztott összeg"),
            new Fact("6", "hónap", "a tartalék célja fix költségben"),
            new Fact("250 500", "Ft", "a tartalékból hiányzik"),
            new Fact("40", "%", "a maradékból a középtávú rekeszbe"));
    }
}
