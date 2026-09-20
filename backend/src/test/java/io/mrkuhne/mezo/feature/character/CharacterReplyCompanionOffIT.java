package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CharacterReplyPopulator;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

import java.util.Map;
import java.util.UUID;

@Import(CharacterReplyPopulator.class)
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CharacterReplyCompanionOffIT extends ApiIntegrationTest {
    @Autowired private CharacterReplyPopulator data;
    @Autowired private OwnerProperties owner;
    @Autowired private CharacterReplyRepository replies;

    @Test
    void testCreate_shouldRemainSavedAndRetryable_whenCompanionDisabled() throws Exception {
        var claim = data.claim(databasePopulator.populateUser(owner.ownerEmail()));
        var response =
                postForBody(
                        "/api/character/replies",
                        Map.of(
                                "sourceType",
                                "CLAIM",
                                "sourceId",
                                claim.getId(),
                                "clientRequestId",
                                UUID.randomUUID(),
                                "text",
                                "A válaszom megmarad."),
                        ownerAuthHeaders(),
                        HttpStatus.OK,
                        Map.class);
        UUID id = UUID.fromString((String) response.get("id"));
        for (int i = 0;
                i < 100 && !"FAILED".equals(replies.findById(id).orElseThrow().getStatus());
                i++) Thread.sleep(50);
        var saved = replies.findById(id).orElseThrow();
        assertThat(saved.getStatus()).isEqualTo("FAILED");
        assertThat(saved.getText()).isEqualTo("A válaszom megmarad.");
        assertThat(saved.getOutcome()).isNull();
    }
}
