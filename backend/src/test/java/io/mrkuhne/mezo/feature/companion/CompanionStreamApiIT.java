package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HTTP-level SSE flow — the hand-written stream endpoint beside the generated surface
 * (the V0.4 CompanionStream contract precedent). TestRestTemplate buffers the finite
 * fake stream, so the raw SSE body is assertable as a plain String.
 */
@ActiveProfiles("companion-fake")
class CompanionStreamApiIT extends ApiIntegrationTest {

    private static final String CONVERSATION_URI = "/api/companion/conversation";

    private HttpHeaders sseHeaders() {
        HttpHeaders headers = ownerAuthHeaders();
        headers.set(HttpHeaders.ACCEPT,
                MediaType.TEXT_EVENT_STREAM_VALUE + ", " + MediaType.APPLICATION_JSON_VALUE);
        return headers;
    }

    private String streamUri(Object conversationId) {
        return CONVERSATION_URI + "/" + conversationId + "/message/stream";
    }

    @Test
    void testStreamMessage_shouldReturn401_whenNoToken() {
        postForBody(streamUri(UUID.randomUUID()),
                SendMessageRequest.builder().content("x").build(),
                null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testStreamMessage_shouldReturn404Json_whenUnknownConversation() {
        String body = postForBody(streamUri(UUID.randomUUID()),
                SendMessageRequest.builder().content("x").build(),
                sseHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testStreamMessage_shouldReturn400FieldError_whenContentEmpty() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String body = postForBody(streamUri(conversation.getId()),
                SendMessageRequest.builder().content("").build(),
                sseHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "content", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testStreamMessage_shouldStreamDeltasThenDoneAndPersist_whenValid() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String sse = postForBody(streamUri(conversation.getId()),
                SendMessageRequest.builder().content("mi a mai terv?").build(),
                sseHeaders(), HttpStatus.OK, String.class);

        assertThat(sse).contains("event:delta").contains("event:done");
        assertThat(sse).contains(FakeCompanionLlm.PREFIX);
        assertThat(sse).contains("\"role\":\"assistant\"");

        List<MessageResponse> messages = getForList(
                CONVERSATION_URI + "/" + conversation.getId() + "/messages",
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getLast().getRole()).isEqualTo("assistant");
        assertThat(messages.getLast().getContent()).startsWith(FakeCompanionLlm.PREFIX);

        List<ConversationResponse> conversations = getForList(
                CONVERSATION_URI, ownerAuthHeaders(), HttpStatus.OK, ConversationResponse.class);
        assertThat(conversations)
                .filteredOn(c -> c.getId().equals(conversation.getId()))
                .singleElement()
                .satisfies(c -> assertThat(c.getTitle()).isEqualTo("mi a mai terv?"));
    }

    @Test
    void testStreamMessage_shouldEmitErrorEventWithoutAssistantRow_whenLlmStreamFails() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String sse = postForBody(streamUri(conversation.getId()),
                SendMessageRequest.builder().content("szállj el " + FakeCompanionLlm.FAIL_STREAM).build(),
                sseHeaders(), HttpStatus.OK, String.class);

        assertThat(sse).contains("event:error").contains("COMPANION_STREAM_FAILED");

        List<MessageResponse> messages = getForList(
                CONVERSATION_URI + "/" + conversation.getId() + "/messages",
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(messages).hasSize(1);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
    }
}
