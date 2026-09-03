package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for the monthly bootstrap konzílium endpoint (Karakter S4, mezo-1gim.6):
 * {@code POST /api/character/bootstrap} — the honest empty state (204, no LLM calls), the
 * canned end-to-end happy path (BOOTSTRAP conference, ACTIVE claims, portraits at version 1, no
 * observation consumption), one-time-ever idempotency (409 on a second call), the fake LLM's
 * marker mirror, and — fix round 1 — that bootstrap seeds the 7 CORE dimensions itself, so a
 * user who never called {@code GET /api/character} first still gets a real dossier out of it
 * instead of a 200 whose claims were silently dropped.
 */
@ActiveProfiles("companion-fake")
class CharacterBootstrapIT extends ApiIntegrationTest {

    @Autowired private CharacterBootstrapService bootstrapService;
    @Autowired private CharacterConferenceRepository conferenceRepository;
    @Autowired private CharacterClaimRepository claimRepository;
    @Autowired private CharacterDimensionRepository dimensionRepository;
    @Autowired private CharacterPortraitRevisionRepository portraitRevisionRepository;
    @Autowired private CharacterObservationRepository observationRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void markers_mirroredInFakeLlm_stayInSync() {
        assertThat(FakeCompanionLlm.BOOTSTRAP_MARKER_MIRROR).isEqualTo(CharacterBootstrapService.BOOTSTRAP_MARKER);
    }

    @Test
    void bootstrap_noHistory_returns204_noConferenceRow() {
        UUID owner = ownerId();
        HttpHeaders headers = ownerAuthHeaders();

        postForBody("/api/character/bootstrap", null, headers, HttpStatus.NO_CONTENT, Void.class);

        assertThat(conferenceRepository.findFirstByCreatedByAndKindOrderByGeneratedAtDesc(owner, "BOOTSTRAP"))
                .isEmpty();
        assertThat(conferenceRepository.findByCreatedByOrderByGeneratedAtDesc(owner)).isEmpty();
    }

    /**
     * The user has NEVER called {@code GET /api/character} — zero dimension rows exist when
     * bootstrap runs. Before the fix-round-1 fix this silently dropped every claim (proposals
     * validate against the static CORE catalog, not the DB, so they get accepted rulings; then
     * {@code ClaimLifecycle.applyNew} finds no dimension row and returns null). This asserts BOTH
     * halves: the 7 CORE dimensions now exist, AND the accepted claims actually landed.
     */
    @Test
    void bootstrap_noPriorDimensionRows_seedsCoreDimensions_andClaimsLandForReal() {
        UUID owner = ownerId();
        assertThat(dimensionRepository.findByCreatedBy(owner)).isEmpty();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 7, 1), "Jó hónap volt, sokat fejlődtem.");
        HttpHeaders headers = ownerAuthHeaders();

        CharacterConferenceResponse response = postForBody("/api/character/bootstrap", null, headers,
                HttpStatus.OK, CharacterConferenceResponse.class);

        assertThat(dimensionRepository.findByCreatedBy(owner)).extracting(CharacterDimensionEntity::getKey)
                .containsExactlyInAnyOrder("physical", "athletic", "nutrition", "recovery",
                        "mental", "discipline", "life", "self-audit");
        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).isNotEmpty();
        assertThat(response.getChanges()).isNotEmpty();
    }

    @Test
    void bootstrap_withHistory_returns200_persistsBootstrapConference_claimsAndPortraits_noObservationConsumed() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 7, 1), "Jó hónap volt, sokat fejlődtem.");
        HttpHeaders headers = ownerAuthHeaders();

        CharacterConferenceResponse response = postForBody("/api/character/bootstrap", null, headers,
                HttpStatus.OK, CharacterConferenceResponse.class);

        assertThat(response.getKind()).isEqualTo(CharacterConferenceResponse.KindEnum.BOOTSTRAP);
        assertThat(response.getWeekStart()).isNull();
        assertThat(response.getTranscript()).extracting("persona")
                .contains("szkeptikus", "mezo")
                .anyMatch(p -> !"szkeptikus".equals(p) && !"mezo".equals(p)); // at least one expert turn

        // final-review Finding M4: bootstrap reads the whole-history narratives, never "the
        // week's observations" — the expert turn text must say so honestly.
        assertThat(response.getTranscript())
                .filteredOn(t -> !"szkeptikus".equals(t.getPersona()) && !"mezo".equals(t.getPersona()))
                .isNotEmpty()
                .allSatisfy(t -> {
                    assertThat(t.getText()).contains("teljes előzmény").contains("bejegyzéséből");
                    assertThat(t.getText()).doesNotContain("hét").doesNotContain("megfigyeléséből");
                });

        assertThat(claimRepository.findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE")).isNotEmpty();

        CharacterDimensionEntity touched = claimRepository
                .findByCreatedByAndStatusOrderByConfidenceDesc(owner, "ACTIVE").stream()
                .findFirst()
                .map(c -> dimensionRepository.findById(c.getDimensionId()).orElseThrow())
                .orElseThrow();
        assertThat(touched.getPortrait()).isNotBlank();
        assertThat(touched.getVersion()).isEqualTo(1);
        assertThat(portraitRevisionRepository.findByCreatedByAndDimensionIdOrderByVersionDesc(owner, touched.getId()))
                .singleElement().satisfies(r -> assertThat(r.getVersion()).isEqualTo(1));

        // bootstrap reads history, not observations — nothing is consumed
        assertThat(observationRepository.findAll()).allSatisfy(o -> {
            if (o.getCreatedBy().equals(owner)) {
                assertThat(o.getConsumedByConferenceId()).isNull();
            }
        });
    }

    @Test
    void bootstrap_secondCall_returns409_stillExactlyOneBootstrapRow() {
        UUID owner = ownerId();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 7, 1), "Jó hónap volt.");
        HttpHeaders headers = ownerAuthHeaders();

        postForBody("/api/character/bootstrap", null, headers, HttpStatus.OK, CharacterConferenceResponse.class);

        String body = postForBody("/api/character/bootstrap", null, headers, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(body, "CHARACTER_BOOTSTRAP_ALREADY_RUN");

        assertThat(conferenceRepository.findByCreatedByOrderByGeneratedAtDesc(owner))
                .filteredOn(s -> "BOOTSTRAP".equals(s.getKind()))
                .hasSize(1);
    }
}
