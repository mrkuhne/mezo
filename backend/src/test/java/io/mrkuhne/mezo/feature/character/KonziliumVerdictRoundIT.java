package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceTranscriptEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.ClaimLifecycle;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the weekly konzílium verdict round (mezo-1gim.5): the empty-proposals fast path (no LLM
 * calls), the canned-fake happy path (every proposal accepted at the canned confidence, exactly
 * two transcript turns), the sentinel-scripted KILL/clamp/blank-chapter/cap path, the honest-
 * transcript contract on a parse failure (no fabricated turn), and the UP/DOWN null-confidence
 * fallback threading through into {@link ClaimLifecycle}.
 */
@ActiveProfiles("companion-fake")
class KonziliumVerdictRoundIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24); // ISO Monday

    @Autowired private KonziliumVerdictRound verdictRound;
    @Autowired private ClaimLifecycle claimLifecycle;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(key);
        entity.setKind("CORE");
        entity.setExpertKey(expertKey);
        return dimensionRepository.save(entity);
    }

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text, BigDecimal confidence) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(confidence);
        entity.setStatus("ACTIVE");
        entity.setProposedBy("drill");
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(confidence, "kezdet", Instant.now()))));
        return claimRepository.save(entity);
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

    @Test
    void run_twoValidChapterTitles_capsAtOne_onlyFirstSurvives() {
        UUID owner = ownerId();
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":[{\"index\":0,\"accept\":true,\"confidence\":0.5,\"reason\":\"ok\"}],"
                + "\"chapters\":["
                + "{\"title\":\"Első fejezet\",\"rationale\":\"r1\"},"
                + "{\"title\":\"Második fejezet\",\"rationale\":\"r2\"}"
                + "]}]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Javaslat.",
                        new BigDecimal("0.50"), false, integratorSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals);

        assertThat(result.chapters()).singleElement()
                .satisfies(c -> assertThat(c.title()).isEqualTo("Első fejezet"));
    }

    @Test
    void run_skepticAnswerFailsToParse_noSzkeptikusTurn_butIntegratorTurnStillWritten() {
        UUID owner = ownerId();
        // matching brackets so the sentinel regex matches, but invalid JSON syntax inside — forces
        // the catch-and-log parse-failure path, NOT the "empty answer" default path
        String brokenSkepticSentinel = "[fake-char-skeptic:[{\"index\":0,\"verdict\":}]]";
        List<ClaimProposal> proposals = List.of(
                new ClaimProposal("drill", "NEW", "discipline", null, "Javaslat.",
                        new BigDecimal("0.50"), false, brokenSkepticSentinel));

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, proposals);

        // the Integrátor still gets a canned fallback answer (no integrator sentinel here), so its
        // turn is genuinely parsed and honest — only the szkeptikus turn is suppressed
        assertThat(result.turns()).extracting(ConferenceTranscriptEnvelope.Turn::persona).containsExactly("mezo");
        assertThat(result.rulings()).hasSize(1); // downstream defaulting still ran off the empty verdict map
    }

    @Test
    void run_upRulingOmitsConfidence_leavesRuledConfidenceNull_lifecycleStepsFromCurrent() {
        UUID owner = ownerId();
        UUID conferenceId = UUID.randomUUID();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "drill");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Fegyelmezett hét.", new BigDecimal("0.50"));

        // the ruling deliberately OMITS "confidence" — proves the round does not silently fall back
        // to the proposal's own confidence for a non-NEW kind
        String integratorSentinel = "[fake-char-integrator:{"
                + "\"rulings\":[{\"index\":0,\"accept\":true,\"reason\":\"erősödött\"}],"
                + "\"chapters\":[]}]";
        ClaimProposal proposal = new ClaimProposal("drill", "UP", null, claim.getId(),
                "Fegyelmezett hét.", new BigDecimal("0.99"), false, integratorSentinel);

        KonziliumVerdictRound.Result result = verdictRound.run(owner, WEEK_START, List.of(proposal));

        ClaimRuling ruling = result.rulings().get(0);
        assertThat(ruling.accepted()).isTrue();
        assertThat(ruling.ruledConfidence()).isNull();

        List<ConferenceOutcomeEnvelope.Change> changes = claimLifecycle.apply(owner, conferenceId, result.rulings());

        assertThat(changes).singleElement().satisfies(c -> assertThat(c.kind()).isEqualTo("CLAIM_CONFIDENCE_UP"));
        CharacterClaimEntity updated = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(updated.getConfidence()).isEqualByComparingTo(new BigDecimal("0.60")); // 0.50 + 0.10 step
    }
}
