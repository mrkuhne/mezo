package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class CompanionTurnMemoryApiIT extends ApiIntegrationTest {

    private static String url(UUID conversationId, UUID messageId) {
        return "/api/companion/conversation/" + conversationId + "/turn-memory?messageId=" + messageId;
    }

    @Test
    void getTurnMemory_shouldReturn401_withoutToken() {
        getForBody(url(UUID.randomUUID(), UUID.randomUUID()), null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void getTurnMemory_shouldReturn404_forUnknownConversation() {
        getForBody(url(UUID.randomUUID(), UUID.randomUUID()), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void forgetLearned_shouldReturn404_forUnknownConversation() {
        postForBody("/api/companion/conversation/" + UUID.randomUUID() + "/forget-learned",
                java.util.Map.of("triggerMessageId", UUID.randomUUID().toString()),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    @Test
    void previewForgetLearned_shouldReturn401_withoutToken() {
        getForBody("/api/companion/conversation/" + UUID.randomUUID() + "/forget-learned", null,
                HttpStatus.UNAUTHORIZED, String.class);
    }
}
