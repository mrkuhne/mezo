package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Deliberately NOT {@code @Transactional} — the streamed path runs prepareTurn and completeTurn in
 * separate transactions through the proxy, exactly as {@code ChatStreamServiceIT} documents.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.serving-mode=OLD")
class ChatStreamServiceGearIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private List<ServerSentEvent<Object>> stream(String content) {
        UUID userId = databasePopulator.populateUser("gear-stream-" + UUID.randomUUID() + "@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        return chatStreamService.streamMessage(userId, conversation.getId(),
        // gear-audited: this IT's whole subject is the gear; each caller states the gear it wants.
                SendMessageRequest.builder().content(content).build())
            .collectList().block();
    }

    /** The terminal row carries the persisted assistant message — the fake's echo lives there. */
    private static String doneContent(List<ServerSentEvent<Object>> events) {
        return events.stream()
            .filter(e -> "done".equals(e.event()))
            .map(e -> ((MessageResponse) e.data()).getContent())
            .findFirst()
            .orElseThrow(() -> new AssertionError("the stream ended without a done event"));
    }

    @Test
    void testStreamMessage_shouldTakeTheToolFreeBranch_whenTheTurnNeedsNoData() {
        assertThat(doneContent(stream("Mit gondolsz a kreatinról?")))
            .contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }

    @Test
    void testStreamMessage_shouldStillEndWithDone_whenTheChatGearRuns() {
        List<ServerSentEvent<Object>> events = stream("Mit gondolsz a kreatinról?");

        assertThat(events.getLast().event()).isEqualTo("done");
    }

    @Test
    void testStreamMessage_shouldKeepTodaysPath_whenTheTurnAsksForData() {
        assertThat(doneContent(stream("Mennyit aludtam kedden?")))
            .doesNotContain(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }
}
