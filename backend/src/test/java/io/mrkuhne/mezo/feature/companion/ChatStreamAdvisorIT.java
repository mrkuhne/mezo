package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V1.3 on the streamed path: deltas carry attempt-1 unchecked, the review runs before 'done',
 * and the done row is authoritative — a corrective retry replaces the streamed text silently.
 * NOT @Transactional (two-transaction turn, like ChatStreamServiceIT).
 */
@ActiveProfiles("companion-fake")
class ChatStreamAdvisorIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    private String joinDeltas(List<ServerSentEvent<Object>> events) {
        return events.stream()
                .filter(e -> "delta".equals(e.event()))
                .map(e -> ((StreamDelta) e.data()).getText())
                .collect(Collectors.joining());
    }

    private MessageResponse doneOf(List<ServerSentEvent<Object>> events) {
        ServerSentEvent<Object> done = events.getLast();
        assertThat(done.event()).isEqualTo("done");
        return (MessageResponse) done.data();
    }

    @Test
    void testStreamMessage_shouldCarryRetriedAnswerInDone_whenFirstAnswerViolates() {
        UUID userId = databasePopulator.populateUser("stream-advisor-retry@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("kérdés " + FakeCompanionLlm.VIOLATE_ONCE))
                .collectList().block();

        // attempt-1 streamed as-is: no retry marker in the deltas
        assertThat(joinDeltas(events)).doesNotContain(AdvisorRetry.RETRY_MARKER);
        MessageResponse done = doneOf(events);
        // done = the retried answer (echo carries the corrective block), clean
        assertThat(done.getContent()).contains(AdvisorRetry.RETRY_MARKER);
        assertThat(done.getDegraded()).isFalse();
    }

    @Test
    void testStreamMessage_shouldFlagDoneDegraded_whenRetryStillViolates() {
        UUID userId = databasePopulator.populateUser("stream-advisor-degraded@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS))
                .collectList().block();

        MessageResponse done = doneOf(events);
        assertThat(done.getDegraded()).isTrue();
        assertThat(messageRepository.findById(done.getId()).orElseThrow().isDegraded()).isTrue();
    }
}
