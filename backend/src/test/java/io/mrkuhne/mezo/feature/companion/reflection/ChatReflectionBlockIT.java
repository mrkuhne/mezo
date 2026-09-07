package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S3 (mezo-eq85.3): what Mezo is CURRENTLY watching belongs in the chat prompt — a
 * companion that runs a nightly experiment on you and cannot mention it is not a companion. The
 * fake echoes the assembled system prompt back as the answer, so the persisted reply IS the proof
 * of assembly (the {@code ChatServiceIT} idiom).
 */
@ActiveProfiles("companion-fake")
class ChatReflectionBlockIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testSendMessage_shouldCarryEszrevetelekBlock_whenAHypothesisIsOpen() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflection(owner,
                new TestPlanEnvelope("people:anna", "sleep-duration-h", 1,
                        TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60),
                PatternEntity.STATUS_MONITORING);
        row.setTitle("Anna után jobban alszol");
        row.setEvidenceHits(4);
        row.setEvidenceMisses(1);
        row.setBelief(new BigDecimal("0.380"));
        patternRepository.saveAndFlush(row);
        AiConversationEntity conversation = conversationPopulator.conversation(owner);

        MessageResponse answer = chatService.sendMessage(owner, conversation.getId(),
                SendMessageRequest.builder().content("szia mezo").build());

        assertThat(answer.getContent()).contains("[Észrevételek — amit Mezo most figyel]");
        assertThat(answer.getContent())
                .contains("- Anna után jobban alszol (figyeljük · 4 bejött / 1 nem · bizonyosság 38%)");
    }

    @Test
    void testSendMessage_shouldOmitEszrevetelekBlock_whenNothingIsOpen() {
        UUID owner = userPopulator.createUser().getId();
        patternPopulator.reflection(owner,
                new TestPlanEnvelope("people:bori", "text-mood", 0,
                        TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60),
                PatternEntity.STATUS_REFUTED);
        AiConversationEntity conversation = conversationPopulator.conversation(owner);

        MessageResponse answer = chatService.sendMessage(owner, conversation.getId(),
                SendMessageRequest.builder().content("szia mezo").build());

        assertThat(answer.getContent()).doesNotContain("[Észrevételek");
    }
}
