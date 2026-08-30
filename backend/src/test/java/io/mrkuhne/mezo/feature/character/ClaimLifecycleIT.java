package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ConferenceOutcomeEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.service.ClaimLifecycle;
import io.mrkuhne.mezo.feature.character.service.ClaimProposal;
import io.mrkuhne.mezo.feature.character.service.ClaimRuling;
import io.mrkuhne.mezo.feature.character.service.KonziliumVerdictRound;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * IT for the weekly konzílium's pure-persistence half (mezo-1gim.5): one test per
 * {@link ClaimLifecycle#apply} branch (NEW insert, UP/DOWN move + clamp, RETIRE, rejected =
 * no-op, unknown claim id = silent skip) plus {@link ClaimLifecycle#openChapters}'s slug
 * collision handling.
 */
class ClaimLifecycleIT extends ApiIntegrationTest {

    @Autowired private ClaimLifecycle claimLifecycle;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private CharacterDimensionEntity seedDimension(UUID owner, String key, String title, String expertKey) {
        CharacterDimensionEntity entity = new CharacterDimensionEntity();
        entity.setCreatedBy(owner);
        entity.setKey(key);
        entity.setTitle(title);
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
    void apply_newAccepted_insertsClaimWithEnvelopesAndChange() {
        UUID owner = ownerId();
        UUID conferenceId = UUID.randomUUID();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "Fegyelem", "drill");
        ClaimProposal proposal = new ClaimProposal("drill", "NEW", "discipline", null,
                "3 napja nincs kaja-log.", new BigDecimal("0.55"), true, "3 nap kihagyás.");
        ClaimRuling ruling = new ClaimRuling(proposal, true, new BigDecimal("0.62"), "elfogadva");

        List<ConferenceOutcomeEnvelope.Change> changes = claimLifecycle.apply(owner, conferenceId, List.of(ruling));

        assertThat(changes).singleElement().satisfies(change -> {
            assertThat(change.kind()).isEqualTo("CLAIM_ACCEPTED");
            assertThat(change.dimensionKey()).isEqualTo("discipline");
            assertThat(change.summary()).isEqualTo("3 napja nincs kaja-log.");
        });

        List<CharacterClaimEntity> rows = claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE");
        assertThat(rows).singleElement().satisfies(row -> {
            assertThat(row.getDimensionId()).isEqualTo(dimension.getId());
            assertThat(row.getText()).isEqualTo("3 napja nincs kaja-log.");
            assertThat(row.getConfidence()).isEqualByComparingTo(new BigDecimal("0.62"));
            assertThat(row.getStatus()).isEqualTo("ACTIVE");
            assertThat(row.getOriginConferenceId()).isEqualTo(conferenceId);
            assertThat(row.getProposedBy()).isEqualTo("drill");
            assertThat(row.getSensitive()).isTrue();
            assertThat(row.getEvidence().refs()).containsExactly(
                    new ClaimEvidenceEnvelope.Ref("conference", conferenceId.toString(), "konzílium"));
            assertThat(row.getUserFeedback().events()).isEmpty();
            assertThat(row.getConfidenceHistory().points()).singleElement().satisfies(point -> {
                assertThat(point.value()).isEqualByComparingTo(new BigDecimal("0.62"));
                assertThat(point.cause()).isEqualTo("konzílium");
            });
        });
    }

    @Test
    void apply_newAccepted_unknownDimension_skipsWithoutThrowing() {
        UUID owner = ownerId();
        ClaimProposal proposal = new ClaimProposal("drill", "NEW", "nonsense", null,
                "Sose látott dimenzió.", new BigDecimal("0.5"), false, "r");
        ClaimRuling ruling = new ClaimRuling(proposal, true, new BigDecimal("0.5"), "elfogadva");

        List<ConferenceOutcomeEnvelope.Change> changes =
                claimLifecycle.apply(owner, UUID.randomUUID(), List.of(ruling));

        assertThat(changes).isEmpty();
        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).isEmpty();
    }

    @Test
    void apply_upDown_movesConfidence_appendsHistory_clampsBounds() {
        UUID owner = ownerId();
        UUID conferenceId = UUID.randomUUID();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "Fegyelem", "drill");

        // UP with an explicit ruled confidence near the ceiling -> clamps to 0.95
        CharacterClaimEntity upClaim = seedClaim(owner, dimension.getId(), "Fegyelmezett hét.", new BigDecimal("0.50"));
        ClaimProposal upProposal = new ClaimProposal("drill", "UP", null, upClaim.getId(),
                "Fegyelmezett hét.", new BigDecimal("0.50"), false, "erősödött");
        ClaimRuling upRuling = new ClaimRuling(upProposal, true, new BigDecimal("0.99"), "elfogadva");

        // DOWN with NO ruled confidence -> falls back to current - 0.10
        CharacterClaimEntity downClaim = seedClaim(owner, dimension.getId(), "Kihagyások.", new BigDecimal("0.50"));
        ClaimProposal downProposal = new ClaimProposal("drill", "DOWN", null, downClaim.getId(),
                "Kihagyások.", new BigDecimal("0.50"), false, "gyengült");
        ClaimRuling downRuling = new ClaimRuling(downProposal, true, null, "elfogadva");

        List<ConferenceOutcomeEnvelope.Change> changes =
                claimLifecycle.apply(owner, conferenceId, List.of(upRuling, downRuling));

        assertThat(changes).extracting(ConferenceOutcomeEnvelope.Change::kind)
                .containsExactly("CLAIM_CONFIDENCE_UP", "CLAIM_CONFIDENCE_DOWN");

        CharacterClaimEntity upRow = claimRepository.findById(upClaim.getId()).orElseThrow();
        assertThat(upRow.getConfidence()).isEqualByComparingTo(new BigDecimal("0.95")); // 0.99 clamped
        assertThat(upRow.getConfidenceHistory().points()).hasSize(2);
        assertThat(upRow.getConfidenceHistory().points().get(1).cause()).isEqualTo("konzílium");

        CharacterClaimEntity downRow = claimRepository.findById(downClaim.getId()).orElseThrow();
        assertThat(downRow.getConfidence()).isEqualByComparingTo(new BigDecimal("0.40")); // 0.50 - 0.10
        assertThat(downRow.getConfidenceHistory().points()).hasSize(2);
    }

    @Test
    void apply_retireAccepted_flipsStatusAndAppendsHistory() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "Fegyelem", "drill");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Elavult állítás.", new BigDecimal("0.50"));
        ClaimProposal proposal = new ClaimProposal("drill", "RETIRE", null, claim.getId(),
                "Elavult állítás.", new BigDecimal("0.50"), false, "már nem igaz");
        ClaimRuling ruling = new ClaimRuling(proposal, true, null, "elfogadva");

        List<ConferenceOutcomeEnvelope.Change> changes =
                claimLifecycle.apply(owner, UUID.randomUUID(), List.of(ruling));

        assertThat(changes).singleElement().satisfies(change -> assertThat(change.kind()).isEqualTo("CLAIM_RETIRED"));

        CharacterClaimEntity row = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(row.getStatus()).isEqualTo("RETIRED");
        assertThat(row.getConfidenceHistory().points()).hasSize(2);
        assertThat(row.getConfidenceHistory().points().get(1).cause()).isEqualTo("konzílium: nyugdíjazva");
    }

    @Test
    void apply_rejectedRuling_leavesNoTrace() {
        UUID owner = ownerId();
        CharacterDimensionEntity dimension = seedDimension(owner, "discipline", "Fegyelem", "drill");
        CharacterClaimEntity claim = seedClaim(owner, dimension.getId(), "Állítás.", new BigDecimal("0.50"));
        ClaimProposal proposal = new ClaimProposal("drill", "UP", null, claim.getId(),
                "Állítás.", new BigDecimal("0.50"), false, "r");
        ClaimRuling ruling = new ClaimRuling(proposal, false, null, "nem került döntésre");

        List<ConferenceOutcomeEnvelope.Change> changes =
                claimLifecycle.apply(owner, UUID.randomUUID(), List.of(ruling));

        assertThat(changes).isEmpty();
        CharacterClaimEntity row = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(row.getConfidence()).isEqualByComparingTo(new BigDecimal("0.50"));
        assertThat(row.getConfidenceHistory().points()).hasSize(1);
    }

    @Test
    void apply_unknownOrForeignClaimId_skipsWithoutThrowing() {
        UUID owner = ownerId();
        ClaimProposal proposal = new ClaimProposal("drill", "UP", null, UUID.randomUUID(),
                "Sose látott állítás.", new BigDecimal("0.50"), false, "r");
        ClaimRuling ruling = new ClaimRuling(proposal, true, new BigDecimal("0.70"), "elfogadva");

        List<ConferenceOutcomeEnvelope.Change> changes =
                claimLifecycle.apply(owner, UUID.randomUUID(), List.of(ruling));

        assertThat(changes).isEmpty();
    }

    @Test
    void openChapters_slugCollision_suffixesTheSecondKey() {
        UUID owner = ownerId();
        UUID conferenceId = UUID.randomUUID();
        List<KonziliumVerdictRound.ChapterProposal> chapters = List.of(
                new KonziliumVerdictRound.ChapterProposal("Munka stressz", "első"),
                new KonziliumVerdictRound.ChapterProposal("Munka stressz", "második"));

        List<ConferenceOutcomeEnvelope.Change> changes = claimLifecycle.openChapters(owner, conferenceId, chapters);

        assertThat(changes).extracting(ConferenceOutcomeEnvelope.Change::dimensionKey)
                .containsExactly("munka-stressz", "munka-stressz-2");
        assertThat(changes).allSatisfy(c -> assertThat(c.kind()).isEqualTo("CHAPTER_OPENED"));

        Optional<CharacterDimensionEntity> first = dimensionRepository.findByCreatedByAndKey(owner, "munka-stressz");
        Optional<CharacterDimensionEntity> second = dimensionRepository.findByCreatedByAndKey(owner, "munka-stressz-2");
        assertThat(first).isPresent();
        assertThat(second).isPresent();
        assertThat(first.get().getKind()).isEqualTo("CHAPTER");
        assertThat(first.get().getExpertKey()).isNull();
        assertThat(first.get().getMaturity()).isZero();
    }
}
