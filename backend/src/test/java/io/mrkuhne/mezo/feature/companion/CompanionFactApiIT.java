package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The V1.1 fact CRUD surface over HTTP — contract statuses + SystemMessage error shapes. */
class CompanionFactApiIT extends ApiIntegrationTest {

    private static final String FACTS = "/api/companion/fact";

    private CreateFactRequest createRequest(String factText, String category) {
        return CreateFactRequest.builder().factText(factText).category(category).build();
    }

    @Test
    void testListFacts_shouldReturn401_whenNoToken() {
        getForBody(FACTS, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateFact_shouldPersistAndRoundTrip_whenValid() {
        KnowledgeFactResponse created = postForBody(FACTS, createRequest("Laktózérzékeny", "health"),
                ownerAuthHeaders(), HttpStatus.CREATED, KnowledgeFactResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getFactText()).isEqualTo("Laktózérzékeny");
        assertThat(created.getCategory()).isEqualTo("health");
        assertThat(created.getSource()).isEqualTo("manual");
        assertThat(created.getReinforcementCount()).isZero();
        assertThat(created.getIncludeInPrompt()).isTrue();

        List<KnowledgeFactResponse> facts =
                getForList(FACTS, ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);
        assertThat(facts).extracting(KnowledgeFactResponse::getId).contains(created.getId());
    }

    @Test
    void testCreateFact_shouldReturn400FieldError_whenFactTextEmpty() {
        String body = postForBody(FACTS, createRequest("", "health"),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "factText", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreateFact_shouldReturn400FieldError_whenCategoryUnknown() {
        String body = postForBody(FACTS, createRequest("valami", "sport"),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "category", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testUpdateFact_shouldToggleIncludeInPrompt_whenPatched() {
        KnowledgeFactResponse created = postForBody(FACTS, createRequest("Reggel edz", "train"),
                ownerAuthHeaders(), HttpStatus.CREATED, KnowledgeFactResponse.class);

        KnowledgeFactResponse updated = patchForBody(FACTS + "/" + created.getId(),
                UpdateFactRequest.builder().includeInPrompt(false).build(),
                ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);

        assertThat(updated.getIncludeInPrompt()).isFalse();
        assertThat(updated.getFactText()).isEqualTo("Reggel edz");

        List<KnowledgeFactResponse> facts =
                getForList(FACTS, ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);
        assertThat(facts).filteredOn(f -> f.getId().equals(created.getId()))
                .singleElement()
                .satisfies(f -> assertThat(f.getIncludeInPrompt()).isFalse());
    }

    @Test
    void testUpdateFact_shouldReturn404_whenUnknownId() {
        String body = patchForBody(FACTS + "/" + UUID.randomUUID(),
                UpdateFactRequest.builder().includeInPrompt(false).build(),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
