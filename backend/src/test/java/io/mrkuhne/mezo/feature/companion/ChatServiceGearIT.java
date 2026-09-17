package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/** The gear branch against the deterministic fake — the fake echoes its inputs, so the assembled
 *  prompt is observable in the answer (same trick as ChatServiceIT). */
@Transactional
@ActiveProfiles("companion-fake")
class ChatServiceGearIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private UserPopulator userPopulator;

    /** One owner, one conversation, one turn — returns the assistant's content. */
    private String sendAndReturnAnswer(String content) {
        AppUserEntity user = userPopulator.createUser("gear-" + UUID.randomUUID() + "@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(user.getId());
        return chatService.sendMessage(user.getId(), conversation.getId(),
        // gear-audited: this IT's whole subject is the gear; each caller states the gear it wants.
            SendMessageRequest.builder().content(content).build()).getContent();
    }

    @Test
    void testSendMessage_shouldTakeTheToolFreeBranch_whenTheTurnNeedsNoData() {
        String answer = sendAndReturnAnswer("Mit gondolsz a kreatinról?");

        assertThat(answer).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
    }

    @Test
    void testSendMessage_shouldOmitTheHeavyContextBlocks_whenTheTurnNeedsNoData() {
        String answer = sendAndReturnAnswer("Mit gondolsz a kreatinról?");

        // The voice survives; the expensive volatile blocks do not.
        assertThat(answer).contains("Te vagy a mezo");
        assertThat(answer).doesNotContain("AKTUÁLIS ÁLLAPOT");
        assertThat(answer).doesNotContain("[Emlékek]");
        assertThat(answer).doesNotContain("[Összefüggések]");
    }

    @Test
    void testSendMessage_shouldKeepTodaysPath_whenTheTurnAsksForData() {
        String answer = sendAndReturnAnswer("Mennyit aludtam kedden?");

        assertThat(answer).doesNotContain(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
        assertThat(answer).contains("AKTUÁLIS ÁLLAPOT");
    }
}
