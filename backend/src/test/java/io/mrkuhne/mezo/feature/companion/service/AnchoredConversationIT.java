package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.ConversationResponse;
import io.mrkuhne.mezo.api.dto.CreateConversationRequest;
import io.mrkuhne.mezo.api.dto.CreateConversationRequestContext;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Anchored conversations (mezo-p2tr, Task 9): a conversation created with {@code context} carries
 * a {@code [Heti adatok]} week/day block on EVERY turn's system prompt and gets a server-generated
 * Mezo opening message. A plain (no-body / no-context) create stays exactly as before.
 */
@Transactional
@ActiveProfiles("companion-fake")
class AnchoredConversationIT extends AbstractIntegrationTest {

    @Autowired private ConversationService conversationService;
    @Autowired private ChatService chatService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    private CreateConversationRequest dayRequest(LocalDate date) {
        return CreateConversationRequest.builder()
                .context(CreateConversationRequestContext.builder().kind("day").date(date).build())
                .build();
    }

    private List<AiMessageEntity> messages(UUID conversationId, UUID userId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId);
    }

    @Test
    void anchoredConversationGetsWeekBlockEveryTurn() {
        UUID userId = databasePopulator.populateUser("anchor-turn@test.local");
        LocalDate seededDay = LocalDate.now().minusDays(1);
        ConversationResponse conversation = conversationService.create(userId, dayRequest(seededDay));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                io.mrkuhne.mezo.api.dto.SendMessageRequest.builder().content("mi volt tegnap?").build());

        assertThat(answer.getContent()).contains("[Heti adatok]");
        assertThat(answer.getContent()).contains("A KIJELÖLT NAP: " + seededDay + " — erről beszélgetünk.");
    }

    @Test
    void openingTurnPersistsAssistantOnlyMessage() {
        UUID userId = databasePopulator.populateUser("anchor-opening@test.local");
        LocalDate seededDay = LocalDate.now();

        ConversationResponse conversation = conversationService.create(userId, dayRequest(seededDay));

        List<AiMessageEntity> rows = messages(conversation.getId(), userId);
        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().getRole()).isEqualTo(AiMessageEntity.ROLE_ASSISTANT);
        assertThat(rows.getFirst().getContent()).isNotBlank();
        assertThat(conversation.getTitle()).isNull();
        AiConversationEntity persisted = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(persisted.getTitle()).isNull();
    }

    @Test
    void openingTurnFailureLeavesEmptyConversation() {
        UUID userId = databasePopulator.populateUser("anchor-fail@test.local");
        LocalDate seededDay = LocalDate.now();
        // FAIL_COMPLETE reaches the fake through the [Regeneráció] check-in note — the opening
        // turn's userMessage is the fixed KICKOFF_PROMPT, so the failure has to ride the dynamic
        // snapshot block instead (see FakeCompanionLlm.complete's systemPrompt check).
        checkInPopulator.createCheckIn(userId, seededDay, "06:30", 5, 5, FakeCompanionLlm.FAIL_COMPLETE);

        ConversationResponse conversation = conversationService.create(userId, dayRequest(seededDay));

        assertThat(conversation.getId()).isNotNull();
        assertThat(messages(conversation.getId(), userId)).isEmpty();
    }

    @Test
    void plainConversationUnchanged() {
        UUID userId = databasePopulator.populateUser("anchor-plain@test.local");

        ConversationResponse conversation = conversationService.create(userId, null);

        AiConversationEntity persisted = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(persisted.getContextKind()).isNull();
        assertThat(persisted.getContextDate()).isNull();
        assertThat(messages(conversation.getId(), userId)).isEmpty();

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                io.mrkuhne.mezo.api.dto.SendMessageRequest.builder().content("szia").build());

        assertThat(answer.getContent()).doesNotContain("[Heti adatok]");
    }
}
