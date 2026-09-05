package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
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
import io.mrkuhne.mezo.support.populator.UserPopulator;
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
    @Autowired private UserPopulator userPopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testSendMessage_shouldAddressTheUserByName_whenSystemPromptIsAssembled() {
        AppUserEntity user = userPopulator.createUser("named-chat@test.local");
        user.setName("Anna");
        userPopulator.save(user);
        UUID userId = user.getId();
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));
        String systemBlock = answer.getContent();

        assertThat(systemBlock).contains("Te vagy a mezo, Anna személyes egészség- és teljesítmény-társa.");
        assertThat(systemBlock).doesNotContain("Daniel").doesNotContain(PromptPersona.NAME_TOKEN);
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
                request("aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"));

        assertThat(resp.getTools()).extracting(MessageTool::getName).containsExactly("get_recovery(scope=sleep, days=3)");
        assertThat(resp.getTools()).extracting(MessageTool::getType).containsExactly("read");
        assertThat(resp.getRefs()).extracting(MessageRef::getKind).contains("Sleep");
        AiMessageEntity assistant = lastAssistantRow(conversation.getId(), userId);
        assertThat(assistant.getToolCalls().calls()).hasSize(1);
        assertThat(assistant.getToolCalls().calls().getFirst().name()).isEqualTo("get_recovery");
        assertThat(assistant.getToolCalls().calls().getFirst().args()).isEqualTo("scope=sleep, days=3");
        assertThat(assistant.getRefs().refs()).isNotEmpty();
        // the fake echoes the tool result — Spring AI's result converter JSON-encodes the String
        assertThat(resp.getContent()).contains("tool:get_recovery=[\"Alvás");
    }

    @Test
    void testSendMessage_shouldBindListDates_whenFakeToolPassesDateArray() {
        UUID userId = databasePopulator.populateUser("chat-tools-detail@test.local");
        LocalDate d = LocalDate.now().minusDays(1);
        sleepLogPopulator.createTrackerSleepLog(userId, d, "23:00", "06:30", new BigDecimal("7.5"),
                4, 1, 450, 10, 200, 80, 60, 87, "screenshot",
                new io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepHypnogram(10, "DRL"), null);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(),
                request("miért fáradt vagyok? [fake-tool:get_recovery {\"scope\":\"sleep\",\"date\":[\""
                        + d + "\"]}]"));

        assertThat(resp.getContent()).contains("tool:get_recovery=[\"Alvás — részletes nézet");
        assertThat(resp.getContent()).contains("lefekvés 23:00").contains("hypnogram: 10 DRL");
        assertThat(resp.getRefs()).extracting(MessageRef::getKind).contains("Sleep");
    }

    @Test
    void testSendMessage_shouldMentionToolsInSystemPrompt_whenSending() {
        UUID userId = databasePopulator.populateUser("chat-tool-hint@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        assertThat(resp.getContent()).contains("használd a kapott tool-okat");
        // mezo-xixu: terse question-type -> tool routing hint, present in EVERY system prompt.
        assertThat(resp.getContent()).contains("[Eszköz-útmutató]");
        assertThat(resp.getContent()).contains("get_exercise_records");
        assertThat(resp.getContent()).contains("get_life_goals");
    }

    @Test
    void testSendMessage_shouldForbidPreToolNarration_whenSystemPromptAssembled() {
        UUID userId = databasePopulator.populateUser("prompt-no-preamble@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        // The tool-routing hint says WHICH tool; this says WHEN — the companion used to stream
        // "most megnézem…" and end the turn there, which reads as answering before it looked.
        assertThat(resp.getContent()).contains("ELŐBB hívd meg");
    }

    @Test
    void testSendMessage_shouldStopRecordingAtCap_whenMoreSentinelsThanBudget() {
        UUID userId = databasePopulator.populateUser("chat-tool-cap@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        String overCapCalls = "[fake-tool:get_goal]".repeat(16);

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(), request(overCapCalls));

        assertThat(resp.getTools()).hasSize(15); // mezo.companion.tools.max-calls-per-turn (raised 6→15, mezo-xixu)
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
        // V1.3: a clean turn is never degraded — persisted and on the wire
        assertThat(rows.getLast().isDegraded()).isFalse();
        assertThat(answer.getRole()).isEqualTo("assistant");
        assertThat(answer.getTools()).isEmpty();
        assertThat(answer.getDegraded()).isFalse();

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getLastMessageAt()).isNotNull();
        assertThat(touched.getTitle()).isEqualTo("mit egyek ma?");
    }

    @Test
    void testSendMessage_shouldInjectContextSnapshotBetweenVoiceAndFacts_whenSending() {
        UUID userId = databasePopulator.populateUser("chat-snapshot@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mi a mai terv?"));

        String echoed = answer.getContent();
        int voice = echoed.indexOf("Te vagy a mezo");
        int snapshot = echoed.indexOf("AKTUÁLIS ÁLLAPOT");
        assertThat(voice).isPositive();
        assertThat(snapshot).isGreaterThan(voice);
        assertThat(echoed).contains("[Profil]").contains("[Regeneráció]");
        // the snapshot renders today's date
        assertThat(echoed).contains("pillanatkép — " + java.time.LocalDate.now());
    }

    @Test
    void testSendMessage_shouldInjectFactsAfterSnapshot_whenConfirmedFactsExist() {
        UUID userId = databasePopulator.populateUser("chat-facts@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);
        factPopulator.fact(userId, "Kikapcsolt tény", "life", 9, false, "manual");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mi a helyzet?"));

        String echoed = answer.getContent();
        int snapshot = echoed.indexOf("AKTUÁLIS ÁLLAPOT");
        int facts = echoed.indexOf("MEGERŐSÍTETT TÉNYEK");
        assertThat(snapshot).isPositive();
        assertThat(facts).isGreaterThan(snapshot);
        assertThat(echoed).contains("- (egészség) Laktózérzékeny");
        assertThat(echoed).doesNotContain("Kikapcsolt tény");
    }

    @Test
    void testSendMessage_shouldAcknowledgeFreshPatternFacts_whenPromotedRecently() {
        UUID userId = databasePopulator.populateUser("chat-ack@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // a freshly promoted pattern-fact (createdAt = now) sits inside the ack window (3 days)
        factPopulator.fact(userId, "Stressz rontja az alvást", "health", 0, true, "pattern");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        String echoed = answer.getContent();
        assertThat(echoed).contains("ÚJ FELISMERÉSEK");
        assertThat(echoed).contains("- Stressz rontja az alvást");
        // ordering: the acknowledgment block sits between the facts block and the history
        int facts = echoed.indexOf("MEGERŐSÍTETT TÉNYEK");
        int ack = echoed.indexOf("ÚJ FELISMERÉSEK");
        assertThat(ack).isGreaterThan(facts);
    }

    @Test
    void testSendMessage_shouldNotAcknowledgeToggledOffPatternFact_whenPromptExcluded() {
        UUID userId = databasePopulator.populateUser("chat-ack-off@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // include_in_prompt=false is the user's kill-switch for EVERY injection channel
        factPopulator.fact(userId, "Kikapcsolt felismerés", "health", 0, false, "pattern");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        assertThat(answer.getContent()).doesNotContain("ÚJ FELISMERÉSEK");
        assertThat(answer.getContent()).doesNotContain("Kikapcsolt felismerés");
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
        assertThat(answer.getContent()).contains("Gyógyszer adagolására vonatkozó változtatást");
        assertThat(answer.getContent()).contains("user=[szia mezo]");
        assertThat(answer.getContent()).contains("history=[]");
    }

    @Test
    void testSendMessage_shouldThrowAndPersistNothing_whenModelReturnsNoText() {
        UUID userId = databasePopulator.populateUser("chat-empty@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        assertThatThrownBy(() -> chatService.sendMessage(userId, conversation.getId(),
                request("mennyi a súlyom " + FakeCompanionLlm.EMPTY_ANSWER)))
                .isInstanceOf(SystemRuntimeErrorException.class)
                .hasMessageContaining("COMPANION_EMPTY_ANSWER");

        // No assistant row: the blank answer never becomes history. (In production the throw also
        // rolls the user row back — sendMessage is ONE transaction — but this IT is @Transactional,
        // so the enclosing test transaction is merely marked rollback-only and the row stays
        // visible here. The streamed path, which is what the app actually uses, is asserted
        // end-to-end in ChatStreamServiceIT.)
        assertThat(messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
                        conversation.getId(), userId))
                .extracting(AiMessageEntity::getRole)
                .containsExactly(AiMessageEntity.ROLE_USER);
    }

    @Test
    void testSendMessage_shouldSkipBlankRowsInHistory_whenAnEmptyAnswerWasPersistedBefore() {
        UUID userId = databasePopulator.populateUser("chat-blank-history@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        // A pre-mezo-8z79 blank assistant row: it must never travel as an empty AssistantMessage.
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        String history = answer.getContent()
                .substring(answer.getContent().indexOf("history=["), answer.getContent().indexOf("] user=["));
        assertThat(history).contains("Felhasználó: korábbi kérdés").doesNotContain("Mezo: ");
    }

    @Test
    void testSendMessage_shouldWindowHistoryIntoPrompt_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("chat-window@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "korábbi válasz");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        assertThat(answer.getContent()).contains("Eddigi beszélgetés");
        assertThat(answer.getContent()).contains("Felhasználó: korábbi kérdés");
        assertThat(answer.getContent()).contains("Mezo: korábbi válasz");
        // The current message is the user param, not part of the rendered history block.
        assertThat(answer.getContent()).doesNotContain("Felhasználó: és most?");
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

    @Test
    void testSendMessage_shouldKeepHistoryOutOfSystemPrompt_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("chat-separation@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");
        messagePopulator.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "korábbi válasz");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("és most?"));

        // A fake echója a hívó összeállítását tükrözi: system=[...] history=[...] user=[...]
        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        String historyBlock = echoed.substring(echoed.indexOf("history=["), echoed.indexOf("] user=["));

        // Ez a teszt bukik el, ha valaki visszacsempészi a transcriptet a system promptba.
        assertThat(systemBlock).doesNotContain("Eddigi beszélgetés");
        assertThat(systemBlock).doesNotContain("Felhasználó: korábbi kérdés");
        assertThat(systemBlock).doesNotContain("Mezo: korábbi válasz");
        assertThat(historyBlock).contains("Felhasználó: korábbi kérdés");
        assertThat(historyBlock).contains("Mezo: korábbi válasz");
        // Az aktuális üzenet a user-paraméter, nem a history része.
        assertThat(historyBlock).doesNotContain("Felhasználó: és most?");
        assertThat(echoed).contains("user=[és most?]");
    }

    @Test
    void testSendMessage_shouldDropTerseInstructionAndCarryVoiceRules_whenAssemblingPrompt() {
        UUID userId = databasePopulator.populateUser("chat-voice-rules@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        String echoed = answer.getContent();
        // A "tömören" utasítás okozta a lélektelenül rövid válaszokat — nem térhet vissza.
        assertThat(echoed).doesNotContain("Válaszolj magyarul, tömören");
        assertThat(echoed).contains("[Hogyan beszélsz]");
        assertThat(echoed).contains("[Mit szabad állítani]");
        // A megőrzött guárdok — a klinikai tiltás mezo-lwmq óta gyógyszernév nélkül szól
        assertThat(echoed).contains("Gyógyszer adagolására vonatkozó változtatást");
        assertThat(echoed).contains("[Eszköz-útmutató]");
    }

    @Test
    void testSendMessage_shouldEndPromptWithToneReminder_whenAssemblingPrompt() {
        UUID userId = databasePopulator.populateUser("chat-tone-tail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        String toneReminder = ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-tone-tail@test.local");
        // A recency-pozíció a lényeg: az emlékeztető a futásidejű adatblokkok UTÁN áll.
        assertThat(systemBlock.indexOf(toneReminder))
                .isGreaterThan(systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK"));
        assertThat(systemBlock).endsWith(toneReminder);
    }

    /**
     * The seedless half of the W3.1 coverage — a message with nothing to recall changes nothing.
     * The seed-dependent ambient tests live in {@link ChatServiceAmbientRecallIT}: they assert that
     * the turn COMMITS (both message rows on disk after a failed ANN statement, the Memory refs on
     * the persisted row), which a {@code @Transactional} test — always rolled back — cannot observe.
     * Visibility is not the reason: the ANN query runs on the caller's own connection and does see
     * uncommitted test-transaction rows.
     */
    @Test
    void testSendMessage_shouldOmitMemoriesBlock_whenNothingSimilar() {
        UUID userId = databasePopulator.populateUser("chat-memories-none@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("szia"));

        assertThat(answer.getContent()).doesNotContain("[Emlékek]");
        assertThat(answer.getRefs()).isEmpty();
    }
}
