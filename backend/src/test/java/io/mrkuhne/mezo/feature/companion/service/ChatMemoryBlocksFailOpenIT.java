package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.people.service.PersonFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * S8 (mezo-d6ivw.12) final review: the {@code [Ebben a beszélgetésben]} block is optional, the
 * turn is not. A throwing read inside the block's assembly logs and yields "" — through the real
 * proxied beans, so a participating {@code @Transactional} callee that marked the turn rollback-only
 * would surface here as an UnexpectedRollbackException. Deliberately NOT {@code @Transactional}:
 * the turn must really commit (the {@link PeopleRecallFailOpenIT} lesson).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ChatMemoryBlocksFailOpenIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private DatabasePopulator databasePopulator;
    @MockitoSpyBean private PersonFactService personFactService;

    @Test
    void testSendMessage_shouldCompleteAndPersistTheTurn_whenTheMemoryBlockReadThrows() {
        doThrow(new IllegalStateException("turn-memory boom"))
                .when(personFactService).bySourceRefs(any(), anyString(), anyCollection());
        UUID userId = databasePopulator.populateUser("s8-memblock-failopen@test.local");
        AiConversationEntity conversation = conversations.conversation(userId);
        // an earlier user message, so the block really reads (no messages ⇒ early return)
        messages.message(conversation, AiMessageEntity.ROLE_USER, "Anna holnap költözik.");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("Szia").build());

        assertThat(answer.getContent()).doesNotContain("\n\n[Ebben a beszélgetésben]");
        List<AiMessageEntity> rows = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId);
        assertThat(rows).extracting(AiMessageEntity::getRole).containsExactly(
                AiMessageEntity.ROLE_USER, AiMessageEntity.ROLE_USER, AiMessageEntity.ROLE_ASSISTANT);
    }
}
