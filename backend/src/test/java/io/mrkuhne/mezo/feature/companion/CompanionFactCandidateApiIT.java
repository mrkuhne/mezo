package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.FactCandidateResponse;
import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The V1.2 candidate inbox + decision over HTTP — contract statuses + SystemMessage shapes. */
class CompanionFactCandidateApiIT extends ApiIntegrationTest {

    private static final String CANDIDATES = "/api/companion/fact/candidate";

    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private FactDecisionRequest decision(String decision, String refinedText) {
        return FactDecisionRequest.builder().decision(decision).refinedText(refinedText).build();
    }

    @Test
    void testListFactCandidates_shouldReturn401_whenNoToken() {
        getForBody(CANDIDATES, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testDecideFactCandidate_shouldPromoteAndEmptyInbox_whenAccepted() {
        LearnedFactEntity candidate = learnedFactPopulator.candidate(ownerId(), "Laktózérzékeny", "health", null);

        List<FactCandidateResponse> pending =
                getForList(CANDIDATES, ownerAuthHeaders(), HttpStatus.OK, FactCandidateResponse.class);
        assertThat(pending).extracting(FactCandidateResponse::getId).contains(candidate.getId());

        FactCandidateResponse decided = postForBody(CANDIDATES + "/" + candidate.getId() + "/decision",
                decision("accept", null), ownerAuthHeaders(), HttpStatus.OK, FactCandidateResponse.class);
        assertThat(decided.getPromotedFactId()).isNotNull();

        assertThat(getForList(CANDIDATES, ownerAuthHeaders(), HttpStatus.OK, FactCandidateResponse.class))
                .isEmpty();
        List<KnowledgeFactResponse> facts = getForList(
                "/api/companion/fact", ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);
        assertThat(facts).filteredOn(f -> f.getId().equals(decided.getPromotedFactId()))
                .singleElement()
                .satisfies(f -> {
                    assertThat(f.getFactText()).isEqualTo("Laktózérzékeny");
                    assertThat(f.getSource()).isEqualTo("chat");
                });
    }

    @Test
    void testDecideFactCandidate_shouldReturn400FieldError_whenRefineWithoutText() {
        LearnedFactEntity candidate = learnedFactPopulator.candidate(ownerId(), "pontatlan", "life", null);

        String body = postForBody(CANDIDATES + "/" + candidate.getId() + "/decision",
                decision("refine", null), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "refinedText", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testDecideFactCandidate_shouldReturn400Conflict_whenAlreadyDecided() {
        LearnedFactEntity candidate = learnedFactPopulator.candidate(ownerId(), "egyszeri", "life", null);
        postForBody(CANDIDATES + "/" + candidate.getId() + "/decision",
                decision("reject", null), ownerAuthHeaders(), HttpStatus.OK, FactCandidateResponse.class);

        String body = postForBody(CANDIDATES + "/" + candidate.getId() + "/decision",
                decision("accept", null), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "COMPANION_CANDIDATE_ALREADY_DECIDED");
    }

    @Test
    void testDecideFactCandidate_shouldReturn404_whenUnknownId() {
        String body = postForBody(CANDIDATES + "/" + UUID.randomUUID() + "/decision",
                decision("accept", null), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
