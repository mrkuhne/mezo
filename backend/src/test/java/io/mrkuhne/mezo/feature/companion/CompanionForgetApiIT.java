package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CompanionForgetApiIT extends ApiIntegrationTest {

    private static final String FACTS = "/api/companion/fact";

    @Test
    void delete_shouldForgetAndDisappearFromTheList() {
        KnowledgeFactResponse created = postForBody(FACTS,
                CreateFactRequest.builder().factText("Felejtsd el").category("life").build(),
                ownerAuthHeaders(), HttpStatus.CREATED, KnowledgeFactResponse.class);

        deleteAndExpect(FACTS + "/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        List<KnowledgeFactResponse> facts = getForList(FACTS, ownerAuthHeaders(), HttpStatus.OK, KnowledgeFactResponse.class);
        assertThat(facts).noneMatch(f -> f.getId().equals(created.getId()));
    }

    @Test
    void delete_shouldReturn404_forUnknownFact() {
        deleteAndExpect(FACTS + "/" + UUID.randomUUID(), ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }

    @Test
    void delete_shouldReturn401_withoutToken() {
        deleteAndExpect(FACTS + "/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
    }
}
