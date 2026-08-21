package io.mrkuhne.mezo.feature.companion.feedback;

import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.TestPropertySource;

/** With the companion switch OFF, the @ConditionalOnProperty controller (and service) are
 *  absent -> 404. Feedback has no switch of its own (spec §8.1: a companion organ) — it rides
 *  {@code mezo.feature.companion.enabled}. */
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class CompanionFeedbackSwitchOffIT extends ApiIntegrationTest {

    @Test
    void testPutFeedback_shouldReturn404_whenSwitchedOff() {
        putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(UUID.randomUUID())
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }

    @Test
    void testDeleteFeedback_shouldReturn404_whenSwitchedOff() {
        deleteAndExpect(
            "/api/companion/feedback/" + MessageFeedbackEntity.KIND_CHAT_MESSAGE + "/" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND);
    }

    @Test
    void testListFeedback_shouldReturn404_whenSwitchedOff() {
        getForBody("/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_CHAT_MESSAGE
                + "&ids=" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }
}
