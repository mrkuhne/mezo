package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageTool;
import io.mrkuhne.mezo.feature.companion.tools.RecordingToolCallback;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** ChatService against the deterministic fake LLM — asserts persistence AND prompt assembly (the fake echoes its inputs). */
@Transactional
@ActiveProfiles("companion-fake")
class ChatServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    private AiMessageEntity lastAssistantRow(UUID conversationId, UUID userId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId)
                .getLast();
    }

    @Test
    void testSendMessage_shouldPersistToolAuditAndMapChips_whenFakeExecutesScriptedTool() {
        UUID userId = databasePopulator.populateUser("chat-tools@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(),
                request("aludtam eleget? [fake-tool:get_sleep {\"days\":3}]"));

        assertThat(resp.getTools()).extracting(MessageTool::getName).containsExactly("get_sleep(days=3)");
        assertThat(resp.getTools()).extracting(MessageTool::getType).containsExactly("read");
        assertThat(resp.getRefs()).extracting(MessageRef::getKind).contains("Sleep");
        AiMessageEntity assistant = lastAssistantRow(conversation.getId(), userId);
        assertThat(assistant.getToolCalls().calls()).hasSize(1);
        assertThat(assistant.getToolCalls().calls().getFirst().name()).isEqualTo("get_sleep");
        assertThat(assistant.getToolCalls().calls().getFirst().args()).isEqualTo("days=3");
        assertThat(assistant.getRefs().refs()).isNotEmpty();
        // the fake echoes the tool result — Spring AI's result converter JSON-encodes the String
        assertThat(resp.getContent()).contains("tool:get_sleep=[\"Alvás");
    }

    @Test
    void testSendMessage_shouldMentionToolsInSystemPrompt_whenSending() {
        UUID userId = databasePopulator.populateUser("chat-tool-hint@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        assertThat(resp.getContent()).contains("használd a kapott tool-okat");
    }

    @Test
    void testSendMessage_shouldStopRecordingAtCap_whenMoreSentinelsThanBudget() {
        UUID userId = databasePopulator.populateUser("chat-tool-cap@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        String sevenCalls = "[fake-tool:get_goal_progress]".repeat(7);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(), request(sevenCalls));

        assertThat(resp.getTools()).hasSize(6); // mezo.companion.tools.max-calls-per-turn
        assertThat(resp.getContent()).contains(RecordingToolCallback.BUDGET_EXHAUSTED);
    }

    @Test
    void testSendMessage_shouldPersistUserAndAssistantRows_whenFirstMessage() {
        UUID userId = databasePopulator.populateUser("chat-first@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mit egyek ma?"));

        List<AiMessageEntity> rows = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId);
        assertThat(rows).hasSize(2);
        assertThat(rows.getFirst().getRole()).isEqualTo(AiMessageEntity.ROLE_USER);
        assertThat(rows.getFirst().getContent()).isEqualTo("mit egyek ma?");
        assertThat(rows.getLast().getRole()).isEqualTo(AiMessageEntity.ROLE_ASSISTANT);
        assertThat(rows.getLast().getContent()).startsWith(FakeCompanionLlm.PREFIX);
        assertThat(rows.getLast().getToolCalls()).isNull();
        assertThat(rows.getLast().getRefs()).isNull();
        assertThat(answer.getRole()).isEqualTo("assistant");
        assertThat(answer.getTools()).isEmpty();

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getLastMessageAt()).isNotNull();
        assertThat(touched.getTitle()).isEqualTo("mit egyek ma?");
    }

    @Test
    void testSendMessage_shouldInjectContextSnapshotBetweenVoiceAndHistory_whenSending() {
        UUID userId = databasePopulator.populateUser("chat-snapshot@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mi a mai terv?"));

        String echoed = answer.getContent();
        int voice = echoed.indexOf("Te vagy a mezo");
        int snapshot = echoed.indexOf("AKTUÁLIS ÁLLAPOT");
        int history = echoed.indexOf("Eddigi beszélgetés");
        assertThat(voice).isPositive();
        assertThat(snapshot).isGreaterThan(voice);
        assertThat(history).isGreaterThan(snapshot);
        assertThat(echoed).contains("[Profil]").contains("[Regeneráció]");
        // the snapshot renders today's date
        assertThat(echoed).contains("pillanatkép — " + java.time.LocalDate.now());
    }

    @Test
    void testSendMessage_shouldInjectFactsBetweenSnapshotAndHistory_whenConfirmedFactsExist() {
        UUID userId = databasePopulator.populateUser("chat-facts@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);
        factPopulator.fact(userId, "Kikapcsolt tény", "life", 9, false, "manual");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mi a helyzet?"));

        String echoed = answer.getContent();
        int snapshot = echoed.indexOf("AKTUÁLIS ÁLLAPOT");
        int facts = echoed.indexOf("MEGERŐSÍTETT TÉNYEK");
        int history = echoed.indexOf("Eddigi beszélgetés");
        assertThat(snapshot).isPositive();
        assertThat(facts).isGreaterThan(snapshot);
        assertThat(history).isGreaterThan(facts);
        assertThat(echoed).contains("- (egészség) Laktózérzékeny");
        assertThat(echoed).doesNotContain("Kikapcsolt tény");
    }

    @Test
    void testSendMessage_shouldOmitFactsBlock_whenUserHasNoFacts() {
        UUID userId = databasePopulator.populateUser("chat-no-facts@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        assertThat(answer.getContent()).doesNotContain("MEGERŐSÍTETT TÉNYEK");
    }

    @Test
    void testSendMessage_shouldIncludeCompanionVoiceAndUserMessageInPrompt_whenCalled() {
        UUID userId = databasePopulator.populateUser("chat-voice@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia mezo"));

        // The fake echoes system=[...] user=[...] — the persisted answer proves prompt assembly.
        assertThat(answer.getContent()).contains("Te vagy a mezo");
        assertThat(answer.getContent()).contains("retatrutid");
        assertThat(answer.getContent()).contains("user=[szia mezo]");
        assertThat(answer.getContent()).doesNotContain("Eddigi beszélgetés");
    }

    @Test
    void testSendMessage_shouldWindowHistoryIntoPrompt_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("chat-window@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "korábbi válasz");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        assertThat(answer.getContent()).contains("Eddigi beszélgetés");
        assertThat(answer.getContent()).contains("Daniel: korábbi kérdés");
        assertThat(answer.getContent()).contains("Mezo: korábbi válasz");
        // The current message is the user param, not part of the rendered history block.
        assertThat(answer.getContent()).doesNotContain("Daniel: és most?");
        assertThat(answer.getContent()).contains("user=[és most?]");
    }

    @Test
    void testSendMessage_shouldLimitHistoryToWindow_whenMoreMessagesThanWindow() {
        UUID userId = databasePopulator.populateUser("chat-limit@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // 22 prior messages with window=20: the 2 oldest must fall out.
        for (int i = 1; i <= 22; i++) {
            messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "üzenet-" + i);
        }

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("összegzés?"));

        assertThat(answer.getContent()).doesNotContain("üzenet-1\n");
        assertThat(answer.getContent()).doesNotContain("üzenet-2\n");
        assertThat(answer.getContent()).contains("üzenet-3");
        assertThat(answer.getContent()).contains("üzenet-22");
    }

    @Test
    void testSendMessage_shouldTruncateTitle_whenFirstMessageLong() {
        UUID userId = databasePopulator.populateUser("chat-title@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        String longContent = "x".repeat(200);

        chatService.sendMessage(userId, conversation.getId(), request(longContent));

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).hasSize(80);
    }

    @Test
    void testSendMessage_shouldKeepTitle_whenSecondMessage() {
        UUID userId = databasePopulator.populateUser("chat-title2@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        chatService.sendMessage(userId, conversation.getId(), request("első téma"));

        chatService.sendMessage(userId, conversation.getId(), request("második üzenet"));

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).isEqualTo("első téma");
    }

    @Test
    void testSendMessage_shouldThrow404_whenConversationNotOwned() {
        UUID mine = databasePopulator.populateUser("chat-notmine@test.local");
        UUID theirs = databasePopulator.populateUser("chat-owner@test.local");
        AiConversationEntity foreign = conversationPopulator.conversation(theirs);

        assertThatThrownBy(() -> chatService.sendMessage(mine, foreign.getId(), request("hahó")))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }
}
