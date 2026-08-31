package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterClaimDto;
import io.mrkuhne.mezo.api.dto.CharacterClaimFeedbackRequest;
import io.mrkuhne.mezo.api.dto.CharacterExpertsResponse;
import io.mrkuhne.mezo.api.dto.CharacterOverviewResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunResponse;
import io.mrkuhne.mezo.api.dto.CharacterRunSummary;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import io.mrkuhne.mezo.feature.character.entity.ClaimConfidenceHistoryEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimEvidenceEnvelope;
import io.mrkuhne.mezo.feature.character.entity.ClaimFeedbackEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunDetectorKeysEnvelope;
import io.mrkuhne.mezo.feature.character.entity.RunExpertKeysEnvelope;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterRunRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/**
 * The companion-off / character-on quadrant (final-review Finding C1, bd mezo-1gim.6): with
 * companion off, {@code CharacterBootstrapService} — {@code @ConditionalOnProperty} array-AND'ed
 * on BOTH the character and companion switches, since it runs an LLM konzílium — does not exist,
 * but {@code CharacterController} itself is character-only (S1 deliberately kept the dossier
 * READS companion-free). The context booting at all with the read surface answering 2xx IS the
 * {@code JournalApiCompanionOffIT} idiom's assertion that no companion-only bean is wired into the
 * character read path; {@code POST /api/character/bootstrap} then answers the HONEST off-state —
 * a 404, never a silent 200 — because the underlying bean is genuinely absent, not because the
 * dossier happens to be empty (that case is a bodyless 204, see {@code CharacterBootstrapIT}).
 *
 * <p>Fix round 1 (mezo-1gim.10): {@code CharacterFeedbackService} is deliberately gated on
 * {@code CHARACTER_SWITCH} alone — no LLM call in the feedback path — specifically so this
 * quadrant can still answer feedback on claims that already exist. That design decision was
 * previously untested; {@link #testClaimFeedback_shouldSucceed_whenCompanionSwitchedOff()} pins it.
 */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CharacterApiCompanionOffIT extends ApiIntegrationTest {

    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private CharacterRunRepository runRepository;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testCharacterReads_shouldSucceed_whenCompanionSwitchedOff() {
        CharacterOverviewResponse overview = getForBody(
                "/api/character", ownerAuthHeaders(), HttpStatus.OK, CharacterOverviewResponse.class);

        assertThat(overview.getDimensions()).hasSize(7);
    }

    @Test
    void testCharacterExperts_shouldSucceed_whenCompanionSwitchedOff() {
        CharacterExpertsResponse res = getForBody(
                "/api/character/experts", ownerAuthHeaders(), HttpStatus.OK, CharacterExpertsResponse.class);

        assertThat(res.getExperts()).hasSize(9);
    }

    @Test
    void testBootstrapCharacter_shouldReturn404_whenCompanionSwitchedOff() {
        String body = postForBody(
                "/api/character/bootstrap", null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testClaimFeedback_shouldSucceed_whenCompanionSwitchedOff() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());

        CharacterDimensionEntity dimension = new CharacterDimensionEntity();
        dimension.setCreatedBy(owner);
        dimension.setKey("discipline");
        dimension.setTitle("Fegyelem");
        dimension.setKind("CORE");
        dimension.setExpertKey("drill");
        dimension = dimensionRepository.save(dimension);

        CharacterClaimEntity claim = new CharacterClaimEntity();
        claim.setCreatedBy(owner);
        claim.setDimensionId(dimension.getId());
        claim.setText("Rendszeresen kihagyja a reggeli naplózást.");
        claim.setConfidence(new BigDecimal("0.50"));
        claim.setStatus("ACTIVE");
        claim.setProposedBy("drill");
        claim.setEvidence(new ClaimEvidenceEnvelope(List.of()));
        claim.setSensitive(false);
        claim.setUserFeedback(new ClaimFeedbackEnvelope(List.of()));
        claim.setConfidenceHistory(new ClaimConfidenceHistoryEnvelope(List.of()));
        claim = claimRepository.save(claim);

        HttpHeaders headers = ownerAuthHeaders();
        CharacterClaimFeedbackRequest request = CharacterClaimFeedbackRequest.builder()
                .kind(CharacterClaimFeedbackRequest.KindEnum.TALAL).build();

        CharacterClaimDto response = postForBody("/api/character/claim/" + claim.getId() + "/feedback",
                request, headers, HttpStatus.OK, CharacterClaimDto.class);

        assertThat(response.getConfidence()).isEqualByComparingTo(new BigDecimal("0.55"));
        CharacterClaimEntity row = claimRepository.findById(claim.getId()).orElseThrow();
        assertThat(row.getConfidence()).isEqualByComparingTo(new BigDecimal("0.55"));
        assertThat(row.getUserFeedback().events()).singleElement()
                .satisfies(event -> assertThat(event.kind()).isEqualTo("TALAL"));
    }

    @Test
    void testCharacterRuns_shouldSucceed_whenCompanionSwitchedOff() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        LocalDate day = LocalDate.of(2026, 8, 10);

        CharacterRunEntity run = new CharacterRunEntity();
        run.setCreatedBy(owner);
        run.setKind("NIGHTLY");
        run.setDay(day);
        run.setObservationCount(0);
        run.setCallCount(0);
        run.setDetectorKeys(new RunDetectorKeysEnvelope(List.of()));
        run.setExpertKeys(new RunExpertKeysEnvelope(List.of()));
        run.setGeneratedAt(Instant.now());
        run = runRepository.save(run);

        CharacterRunSummary[] runs = getForBody(
                "/api/character/runs?from=2026-08-01&to=2026-08-31",
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunSummary[].class);
        assertThat(runs).hasSize(1);

        CharacterRunResponse detail = getForBody("/api/character/run/" + run.getId(),
                ownerAuthHeaders(), HttpStatus.OK, CharacterRunResponse.class);
        assertThat(detail.getSummary().getId()).isEqualTo(run.getId());
        assertThat(detail.getObservations()).isEmpty();
    }
}
