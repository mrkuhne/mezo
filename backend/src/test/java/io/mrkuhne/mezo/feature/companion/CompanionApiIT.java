package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** HTTP-level companion flow against the fake LLM ("companion-fake" merges with the base's "demodata"). */
@ActiveProfiles("companion-fake")
class CompanionApiIT extends ApiIntegrationTest {

    private static final String CONVERSATION_URI = "/api/companion/conversation";

    @Test
    void testListConversations_shouldReturn401_whenNoToken() {
        getForBody(CONVERSATION_URI, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateConversation_shouldReturn201Empty_whenAuthenticated() {
        ConversationResponse created = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getTitle()).isNull();
        assertThat(created.getStartedAt()).isNotNull();
    }

    @Test
    void testSendMessage_shouldReturnAssistantMessageAndPersistFlow_whenValid() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);
        SendMessageRequest request = SendMessageRequest.builder().content("mi a mai terv?").build();

        MessageResponse answer = postForBody(
                CONVERSATION_URI + "/" + conversation.getId() + "/message",
                request, ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);

        assertThat(answer.getRole()).isEqualTo("assistant");
        assertThat(answer.getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(answer.getTools()).isEmpty();
        assertThat(answer.getRefs()).isEmpty();

        List<MessageResponse> messages = getForList(
                CONVERSATION_URI + "/" + conversation.getId() + "/messages",
                ownerAuthHeaders(), HttpStatus.OK, MessageResponse.class);
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getFirst().getContent()).isEqualTo("mi a mai terv?");
        assertThat(messages.getLast().getRole()).isEqualTo("assistant");

        List<ConversationResponse> conversations = getForList(
                CONVERSATION_URI, ownerAuthHeaders(), HttpStatus.OK, ConversationResponse.class);
        assertThat(conversations)
                .filteredOn(c -> c.getId().equals(conversation.getId()))
                .singleElement()
                .satisfies(c -> {
                    assertThat(c.getTitle()).isEqualTo("mi a mai terv?");
                    assertThat(c.getLastMessageAt()).isNotNull();
                });
    }

    @Test
    void testSendMessage_shouldReturn400FieldError_whenContentEmpty() {
        ConversationResponse conversation = postForBody(
                CONVERSATION_URI, null, ownerAuthHeaders(), HttpStatus.CREATED, ConversationResponse.class);

        String body = postForBody(
                CONVERSATION_URI + "/" + conversation.getId() + "/message",
                SendMessageRequest.builder().content("").build(),
                ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        // empty string fails minLength (Size) → VALIDATION_INVALID_VALUE (not REQUIRED_FIELD)
        assertHasFieldError(body, "content", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListMessages_shouldReturn404_whenUnknownConversation() {
        String body = getForBody(
                CONVERSATION_URI + "/" + UUID.randomUUID() + "/messages",
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }
}
