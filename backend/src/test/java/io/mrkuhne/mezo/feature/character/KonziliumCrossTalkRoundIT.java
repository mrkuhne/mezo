package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.KonziliumCrossTalkRound;
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
 * IT for the cross-talk round (mezo-xlvr): only contested chapters trigger a call, an expert
 * never reacts to its own proposal, an unparseable answer yields no reaction (and never breaks
 * the round), and the per-conference call cap holds.
 */
@ActiveProfiles("companion-fake")
class KonziliumCrossTalkRoundIT extends ApiIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.of(2026, 8, 24);

    @Autowired private KonziliumCrossTalkRound crossTalkRound;
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

    private CharacterClaimEntity seedClaim(UUID owner, UUID dimensionId, String text) {
        CharacterClaimEntity entity = new CharacterClaimEntity();
        entity.setCreatedBy(owner);
        entity.setDimensionId(dimensionId);
        entity.setText(text);
        entity.setConfidence(new BigDecimal("0.50"));
        entity.setStatus("ACTIVE");
        entity.setProposedBy("szomnologus");
        entity.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        entity.setSensitive(false);
        entity.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        entity.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(
                List.of(new ClaimConfidenceHistoryEnvelope.Point(new BigDecimal("0.50"), "kezdet", Instant.now()))));
        return claimRepository.save(entity);
    }

    private static ClaimProposal newProposal(String expertKey, String dimensionKey, String text) {
        return new ClaimProposal(expertKey, "NEW", dimensionKey, null, text,
                new BigDecimal("0.50"), false, "Indoklás.");
    }

    @Test
    void marker_mirroredInFakeLlm_staysInSync() {
        assertThat(FakeCompanionLlm.CROSS_TALK_MARKER_MIRROR).isEqualTo(KonziliumCrossTalkRound.CROSS_TALK_MARKER);
    }

    @Test
    void run_singleExpertPerChapter_makesNoCall() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás."),
                newProposal("drill", "discipline", "Kimarad a napló.")));

        assertThat(result.reactions()).isEmpty();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
    }

    @Test
    void run_twoExpertsOnOneChapter_bothReactToTheOther_neverToTheirOwn() {
        UUID owner = ownerId();

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás."),
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted.")));

        assertThat(result.reactions()).hasSize(2);
        assertThat(result.reactions()).anySatisfy(reaction -> {
            assertThat(reaction.expertKey()).isEqualTo("szomnologus");
            assertThat(reaction.index()).isEqualTo(1);
        });
        assertThat(result.reactions()).anySatisfy(reaction -> {
            assertThat(reaction.expertKey()).isEqualTo("pszichologus");
            assertThat(reaction.index()).isZero();
        });
        assertThat(result.reactions()).allSatisfy(reaction ->
                assertThat(reaction.stance()).isIn("SUPPORT", "CHALLENGE", "NUANCE"));
    }

    @Test
    void run_claimTargetingProposals_groupByTheClaimsOwnChapter() {
        UUID owner = ownerId();
        CharacterDimensionEntity recovery = seedDimension(owner, "recovery", "szomnologus");
        CharacterClaimEntity claim = seedClaim(owner, recovery.getId(), "Korábban jól aludtál.");

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted."),
                new ClaimProposal("szomnologus", "DOWN", null, claim.getId(), "Ez már nem áll.",
                        new BigDecimal("0.40"), false, "Az adatok mást mutatnak.")));

        assertThat(result.reactions()).hasSize(2);
    }

    @Test
    void run_unparseableAnswer_yieldsNoReactionForThatExpert_andNeverThrows() {
        UUID owner = ownerId();

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás. [fake-char-crosstalk:nem-json]"),
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted.")));

        // The sentinel is planted in szomnologus's OWN proposal text, which is rendered as a PEER
        // proposal only in pszichologus's call (an expert never sees its own proposal) — so it is
        // pszichologus's answer that comes back unparseable, dropping only pszichologus's reaction;
        // szomnologus's own call still succeeds normally.
        assertThat(result.reactions()).hasSize(1);
        assertThat(result.reactions()).allSatisfy(reaction -> {
            assertThat(reaction.expertKey()).isEqualTo("szomnologus");
            assertThat(reaction.index()).isEqualTo(1);
        });
    }

    /** M1 (mezo-xlvr final review): one expert, one stance per proposal — a repeated index in the
     *  same answer keeps the FIRST stance and drops the rest. */
    @Test
    void run_twoStancesOnTheSameIndexFromOneExpert_keepsOnlyTheFirst() {
        UUID owner = ownerId();
        // Planted in szomnologus's OWN proposal text, so it scripts the answer of the expert that
        // SEES it as a peer proposal: pszichologus, whose only peer index is 0.
        String duplicateStances = " [fake-char-crosstalk:["
                + "{\"index\":0,\"stance\":\"SUPPORT\",\"argument\":\"Első állásfoglalás.\"},"
                + "{\"index\":0,\"stance\":\"CHALLENGE\",\"argument\":\"Második állásfoglalás.\"}"
                + "]]";

        KonziliumCrossTalkRound.Result result = crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "Romlik az alvás." + duplicateStances),
                newProposal("pszichologus", "recovery", "Feszült hét áll mögötted.")));

        assertThat(result.reactions()).filteredOn(reaction -> "pszichologus".equals(reaction.expertKey()))
                .singleElement()
                .satisfies(reaction -> {
                    assertThat(reaction.index()).isZero();
                    assertThat(reaction.stance()).isEqualTo("SUPPORT");
                    assertThat(reaction.argument()).isEqualTo("Első állásfoglalás.");
                });
    }

    @Test
    void run_callCap_stopsAfterTheCappedNumberOfCalls() {
        UUID owner = ownerId();
        int before = fakeCompanionLlm.completeCallCount();

        crossTalkRound.run(owner, WEEK_START, List.of(
                newProposal("szomnologus", "recovery", "A."),
                newProposal("pszichologus", "recovery", "B."),
                newProposal("doki", "physical", "C."),
                newProposal("edzo", "physical", "D."),
                newProposal("taplalkozo", "nutrition", "E."),
                newProposal("drill", "nutrition", "F."),
                newProposal("antropologus", "life", "G."),
                newProposal("szkeptikus", "life", "H.")));

        // 4 contested chapters x 2 experts = 8 available calls against the cap: the round must
        // stop exactly at the cap, not merely at or below it.
        assertThat(fakeCompanionLlm.completeCallCount() - before)
                .isEqualTo(KonziliumCrossTalkRound.MAX_CROSS_TALK_CALLS);
    }
}
