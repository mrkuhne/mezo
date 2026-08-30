package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the weekly konzílium verdict round (mezo-1gim.5): the empty-proposals fast path (no LLM
 * calls), the canned-fake happy path (every proposal accepted at the canned confidence, exactly
 * two transcript turns), and the sentinel-scripted KILL/clamp/blank-chapter path.
 */
@ActiveProfiles("companion-fake")
class KonziliumVerdictRoundIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday

    @Autowired private KonziliumVerdictRound verdictRound;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void markers_mirroredInFakeLlm_stayInSync() {
        assertThat(FakeCompanionLlm.SKEPTIC_MARKER_MIRROR).isEqualTo(KonziliumVerdictRound.SKEPTIC_MARKER);
        assertThat(FakeCompanionLlm.INTEGRATOR_MARKER_MIRROR).isEqualTo(KonziliumVerdictRound.INTEGRATOR_MARKER);
    }

    @Test
    void run_emptyProposals_returnsEmptyResultWithoutAnyLlmCall() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, List.of());

        assertThat(result.rulings()).isEmpty();
        assertThat(result.chapters()).isEmpty();
        assertThat(result.turns()).isEmpty();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
    }

    @Test
    void run_cannedFakeAnswer_everyProposalAcceptedAtCannedConfidence_twoTurns() {
        UUID owner = ownerId();
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Elmarad a logolás.",
                        new BigDecimal("0.50"), false, "3 nap kihagyás."),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Feszült hét.",
                        new BigDecimal("0.40"), false, "Napló jelzi."));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals);

        assertThat(result.rulings()).hasSize(2).allSatisfy(r -> {
            assertThat(r.accepted()).isTrue();
            assertThat(r.ruledConfidence()).isEqualByComparingTo(new BigDecimal("0.60"));
        });
        assertThat(result.chapters()).isEmpty();
        assertThat(result.turns()).hasSize(2)
                .extracting(ConferenceTranscriptEnvelope.Turn::persona)
                .containsExactly("szkeptikus", "mezo");
    }

    @Test
    void run_sentinelScriptsBothRounds_killedProposalRejected_confidenceClamped_blankChapterDropped() {
        UUID owner = ownerId();
        String skepticSentinel = "[fake-char-skeptic:["
                + "{\"index\":0,\"verdict\":\"KILL\",\"argument\":\"Nincs elég bizonyíték.\"},"
                + "{\"index\":1,\"verdict\":\"KEEP\",\"argument\":\"Rendben.\"}"
                + "]]";
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":["
                + "{\"index\":0,\"accept\":false,\"confidence\":0.10,\"reason\":\"killed\"},"
                + "{\"index\":1,\"accept\":true,\"confidence\":0.99,\"reason\":\"ok\"}"
                + "],"
                + "\"chapters\":["
                + "{\"title\":\"\",\"rationale\":\"üres cím\"},"
                + "{\"title\":\"Valid Chapter\",\"rationale\":\"tényleg önálló téma\"}"
                + "]}]";

        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Vitatott javaslat.",
                        new BigDecimal("0.50"), false, skepticSentinel),
                new ClaimProposal("pszichologus", "NEW", "mental", null, "Elfogadott javaslat.",
                        new BigDecimal("0.50"), false, integratorSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals);

        assertThat(result.rulings()).hasSize(2);
        ClaimRuling r0 = result.rulings().get(0);
        ClaimRuling r1 = result.rulings().get(1);
        assertThat(r0.accepted()).isFalse();
        assertThat(r1.accepted()).isTrue();
        assertThat(r1.ruledConfidence()).isEqualByComparingTo(new BigDecimal("0.90")); // 0.99 clamped

        assertThat(result.chapters()).singleElement()
                .satisfies(c -> assertThat(c.title()).isEqualTo("Valid Chapter"));
    }
}
