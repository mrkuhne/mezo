package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Streamed chat turn against the fake LLM — event protocol (delta/done/error) + the
 * two-transaction persistence semantics. Deliberately NOT @Transactional: the streamed
 * path runs prepareTurn and completeTurn in separate transactions through the proxy,
 * and this test observes exactly that (cleanup is the per-test ResetDatabase).
 */
@ActiveProfiles("companion-fake")
class ChatStreamServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private ConversationService conversationService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testStreamMessage_shouldEmitDeltasThenDoneAndPersistBothRows_whenLlmStreams() {
        UUID userId = databasePopulator.populateUser("stream-happy@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("mi a mai terv?"))
                .collectList().block();

        assertThat(events).isNotEmpty();
        assertThat(events.subList(0, events.size() - 1))
                .allSatisfy(e -> {
                    assertThat(e.event()).isEqualTo("delta");
                    assertThat(e.data()).isInstanceOf(StreamDelta.class);
                });
        String joined = events.stream().limit(events.size() - 1)
                .map(e -> ((StreamDelta) e.data()).getText()).reduce("", String::concat);
        assertThat(joined).startsWith(FakeCompanionLlm.PREFIX).contains("user=[mi a mai terv?]");

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("done");
        MessageResponse done = (MessageResponse) last.data();
        assertThat(done.getRole()).isEqualTo("assistant");
        assertThat(done.getContent()).isEqualTo(joined);

        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getFirst().getContent()).isEqualTo("mi a mai terv?");
        assertThat(messages.getLast().getContent()).isEqualTo(joined);

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).isEqualTo("mi a mai terv?");
        assertThat(touched.getLastMessageAt()).isNotNull();
    }

    @Test
    void testStreamMessage_shouldEmitErrorAndKeepOnlyUserRow_whenLlmStreamFails() {
        UUID userId = databasePopulator.populateUser("stream-error@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("szállj el " + FakeCompanionLlm.FAIL_STREAM))
                .collectList().block();

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("error");
        assertThat(((StreamError) last.data()).getCode()).isEqualTo("COMPANION_STREAM_FAILED");

        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());
        assertThat(messages).hasSize(1); // partial answers are NEVER persisted
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
    }

    @Test
    void testStreamMessage_shouldThrow404BeforeStreaming_whenConversationForeign() {
        UUID userId = databasePopulator.populateUser("stream-foreign@test.local");

        assertThatThrownBy(() -> chatStreamService.streamMessage(
                userId, UUID.randomUUID(), request("x")))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
