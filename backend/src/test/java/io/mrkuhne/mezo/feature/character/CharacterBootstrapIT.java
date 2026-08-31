package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CharacterConferenceResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterConferenceRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterObservationRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterPortraitRevisionRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
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
 * observation consumption), one-time-ever idempotency (409 on a second call), and the fake LLM's
 * marker mirror.
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

    private void seedCoreDimensions(UUID owner) {
        // mirrors CharacterService.ensureCoreDimensions — the endpoint under test never calls it,
        // so the bootstrap round needs its own NEW-target dimensions already present, exactly as
        // a real user's dossier would have after their first /api/character GET.
        for (String key : new String[] {"discipline", "physical", "athletic", "nutrition", "recovery", "mental",
                "life"}) {
            CharacterDimensionEntity entity = new CharacterDimensionEntity();
            entity.setCreatedBy(owner);
            entity.setKey(key);
            entity.setTitle(key);
            entity.setKind("CORE");
            entity.setExpertKey(switch (key) {
                case "discipline" -> "drill";
                case "physical" -> "doki";
                case "athletic" -> "edzo";
                case "nutrition" -> "taplalkozo";
                case "recovery" -> "szomnologus";
                case "mental" -> "pszichologus";
                default -> "antropologus";
            });
            dimensionRepository.save(entity);
        }
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

    @Test
    void bootstrap_withHistory_returns200_persistsBootstrapConference_claimsAndPortraits_noObservationConsumed() {
        UUID owner = ownerId();
        seedCoreDimensions(owner);
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 7, 1), "Jó hónap volt, sokat fejlődtem.");
        HttpHeaders headers = ownerAuthHeaders();

        CharacterConferenceResponse response = postForBody("/api/character/bootstrap", null, headers,
                HttpStatus.OK, CharacterConferenceResponse.class);

        assertThat(response.getKind()).isEqualTo(CharacterConferenceResponse.KindEnum.BOOTSTRAP);
        assertThat(response.getWeekStart()).isNull();
        assertThat(response.getTranscript()).extracting("persona")
                .contains("szkeptikus", "mezo")
                .anyMatch(p -> !"szkeptikus".equals(p) && !"mezo".equals(p)); // at least one expert turn

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
        seedCoreDimensions(owner);
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
