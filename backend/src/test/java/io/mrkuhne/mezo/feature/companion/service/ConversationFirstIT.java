package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.conversation.enabled=true")
class ConversationFirstIT extends AbstractIntegrationTest {
    @Autowired private ChatService chatService;
    @Autowired private ChatStreamService streamService;
    @Autowired private AiConversationPopulator conversations;
    @Autowired private AiMessagePopulator messages;
    @Autowired private DatabasePopulator users;
    @Autowired private SleepLogPopulator sleeps;
    @Autowired private io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository messageRepository;
    @Autowired private io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry tools;
    @Autowired private io.mrkuhne.mezo.feature.companion.tools.ConversationContextTools contextTools;
    @Autowired private io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator memories;
    @Autowired private io.mrkuhne.mezo.feature.companion.EmbeddingPort embeddings;

    private static final String SLEEP_PLAN = " [fake-plan:{\"needsData\":true,\"steps\":["
            + "{\"tool\":\"get_recovery\",\"args\":{\"scope\":\"sleep\",\"days\":3},\"why\":\"folytatás\"}]}]";
    private static final String NO_DATA = " [fake-plan:{\"needsData\":false,\"steps\":[]}]";

    // gear-audited: conversation-first deliberately does not classify individual messages.
    private SendMessageRequest request(String text) {
        return SendMessageRequest.builder().content(text).build();
    }

    @Test
    void testPrepareTurn_shouldAvoidHealthReport_whenGeneralQuestionContainsDomainWords() {
        UUID user = users.populateUser("free-general@test.local");
        var conversation = conversations.conversation(user);
        var turn = chatService.prepareTurn(user, conversation.getId(), request("Miért fontos az alvás?"));
        assertThat(turn.turnContext()).doesNotContain("AKTUÁLIS ÁLLAPOT", "ÚJ FELISMERÉSEK");
        assertThat(turn.systemPrompt()).contains("bármilyen témáról")
                .doesNotContain("többes szám első személy", "[Két mód]", "négynél több");
    }

    @Test
    void testSendMessage_shouldCatchFabricatedActionClaim_whenConversationFirstAnswerClaimsAWrite() {
        // S9.8 Task 3 (mezo-rj214.7, mezo-rj214.5) — the real headline: production shipped
        // "Felírtam: taco…" though the companion has no write tool, and that bug's own path is
        // THIS one — conversation-first (this class's @TestPropertySource), the shipped default.
        // Before Task 3, ChatService.sendMessage's conversation-first branch called
        // chain.reviewChat, which ran ONLY ClinicalOutputCheck inline and never reached runChecks
        // at all — ActionClaimCheck (Tasks 1-2's deterministic backstop) never covered the path
        // the incident actually shipped from. Task 3 collapsed review/reviewChat into one method
        // that always runs clinical + action-claim, so this now catches it.
        UUID user = users.populateUser("free-action-claim@test.local");
        var conversation = conversations.conversation(user);

        var answer = chatService.sendMessage(user, conversation.getId(),
                request("Mit ettem ma? " + FakeCompanionLlm.ACTION_CLAIM_ONCE));

        // the fake fabricates "Felírtam…" on round 1 unconditionally and only rewrites to this
        // exact clean sentence once the corrective retry actually ran (see
        // FakeCompanionLlm.ACTION_CLAIM_ONCE's own javadoc) — so this proves the catch, not a
        // lucky clean first answer.
        assertThat(answer.getContent()).isEqualTo("Ezt te tudod felírni, ha szeretnéd.");
        assertThat(answer.getDegraded()).isFalse();
    }

    @Test
    void testPrepareTurn_shouldCarryActionHonestyRule_whenSystemPromptIsRendered() {
        UUID user = users.populateUser("free-honesty@test.local");
        var conversation = conversations.conversation(user);
        var turn = chatService.prepareTurn(user, conversation.getId(), request("Szia"));
        assertThat(turn.systemPrompt()).contains("Nem tudsz naplózni, menteni, módosítani vagy bármit elvégezni",
                "Soha ne állítsd, hogy elvégeztél valamit");
    }

    @Test
    void testSendMessage_shouldReadPersonalData_whenFollowupHasNoDomainKeywords() {
        UUID user = users.populateUser("free-followup@test.local");
        var conversation = conversations.conversation(user);
        messages.message(conversation, AiMessageEntity.ROLE_USER, "Az alvásomról szeretnék beszélni.");
        messages.message(conversation, AiMessageEntity.ROLE_ASSISTANT, "Megnézhetjük az elmúlt napokat.");
        sleeps.createSleepLog(user, LocalDate.now(), new BigDecimal("7.5"), 2);
        var answer = chatService.sendMessage(user, conversation.getId(), request("És ez miért lehet?" + SLEEP_PLAN));
        assertThat(answer.getTools()).hasSize(1);
        assertThat(answer.getContent()).contains("7,5").doesNotContain("AKTUÁLIS ÁLLAPOT");
    }

    @Test
    void testPrepareTurn_shouldRetainEarlierTopic_whenConversationExceedsTenExchanges() {
        UUID user = users.populateUser("free-history@test.local");
        var conversation = conversations.conversation(user);
        messages.message(conversation, AiMessageEntity.ROLE_USER, "A regényem főhőse Boróka.");
        for (int i = 0; i < 24; i++) {
            messages.message(conversation, i % 2 == 0 ? "assistant" : "user", "További részlet " + i);
        }
        var turn = chatService.prepareTurn(user, conversation.getId(), request("Mi legyen vele?"));
        assertThat(turn.history()).anySatisfy(t -> assertThat(t.content()).contains("Boróka"));
    }

    @Test
    void testStreamMessage_shouldStreamMultipleTextChunks_whenQuestionNeedsAnalysis() {
        UUID user = users.populateUser("free-stream@test.local");
        var conversation = conversations.conversation(user);
        var events = streamService.streamMessage(user, conversation.getId(),
                request("Miért fontos az alvás?" + NO_DATA)).collectList().block(Duration.ofSeconds(30));
        assertThat(events).isNotNull();
        assertThat(events.stream().filter(e -> "delta".equals(e.event())).map(e -> (StreamDelta)e.data()).toList())
                .hasSizeGreaterThan(1);
        assertThat(events.getLast().event()).isEqualTo("done");
        assertThat(events).noneMatch(e -> "error".equals(e.event()));
    }

    @Test
    void testPrepareTurn_shouldRejectForeignConversation_whenAnotherUserRequestsIt() {
        UUID owner = users.populateUser("free-owner@test.local");
        UUID other = users.populateUser("free-other@test.local");
        var conversation = conversations.conversation(owner);
        assertThatThrownBy(() -> chatService.prepareTurn(other, conversation.getId(), request("Szia")))
                .isInstanceOf(io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException.class);
    }

    @Test
    void testPrepareTurn_shouldRestoreToolEvidence_whenFollowingUpOnPreviousAnswer() {
        UUID user = users.populateUser("free-evidence@test.local");
        var conversation = conversations.conversation(user);
        sleeps.createSleepLog(user, LocalDate.now(), new BigDecimal("6.5"), 3);
        var answer = chatService.sendMessage(user, conversation.getId(), request("Nézzük meg." + SLEEP_PLAN));
        var stored = messageRepository.findById(answer.getId()).orElseThrow();
        // mezo-rj214.10 unification: the RESULT text has ONE home, ai_message.tool_outcomes
        // (the 90-day-scrubbed column); tool_calls keeps only the ask (name/args/why).
        assertThat(stored.getToolOutcomes().outcomes().getFirst().text()).contains("6,5");
        assertThat(stored.getToolCalls().calls().getFirst().name()).isEqualTo("get_recovery");
        var turn = chatService.prepareTurn(user, conversation.getId(), request("És ebből mi következik?"));
        assertThat(turn.history()).anySatisfy(t -> assertThat(t.content())
                .contains("Korábbi eszközadat", "nem friss mérés", "6,5"));
    }

    @Test
    void testSendMessage_shouldExecuteDependentRead_whenFirstResultNeedsMoreContext() {
        UUID user = users.populateUser("free-dependent@test.local");
        var conversation = conversations.conversation(user);
        String next = " [fake-next-plan:{\"needsData\":true,\"steps\":["
                + "{\"tool\":\"get_personal_context\",\"args\":{\"scope\":\"facts\"},\"why\":\"háttér\"}]}]";
        var answer = chatService.sendMessage(user, conversation.getId(), request("És ez?" + SLEEP_PLAN + next));
        assertThat(answer.getTools()).hasSize(2);
        assertThat(answer.getContent()).contains("- get_recovery", "- get_personal_context");
    }

    @Test
    void testSendMessage_shouldExplainUnavailableRetrieval_whenPlanCannotBeParsed() {
        UUID user = users.populateUser("free-broken@test.local");
        var conversation = conversations.conversation(user);
        var answer = chatService.sendMessage(user, conversation.getId(),
                request("Mi lehet az oka? [fake-broken-conversation-plan]"));
        assertThat(answer.getContent()).contains("nem sikerült; ez nem az adatok hiánya");
        assertThat(answer.getDegraded()).isTrue();
    }

    @Test
    void testConversationHistory_shouldReadOlderPageWithoutOtherUsers_whenWindowWasExceeded() {
        UUID user = users.populateUser("free-old@test.local");
        UUID other = users.populateUser("free-old-other@test.local");
        var conversation = conversations.conversation(user);
        messages.message(conversation, "user", "A régi ötlet: csillagközi kertészet.");
        for (int i = 0; i < 85; i++) {
            messages.message(conversation, "assistant", "Részlet " + i);
        }
        var audit = tools.newTurnAudit();
        var ctx = new java.util.HashMap<String, Object>(tools.toolContext(user, audit));
        ctx.put(io.mrkuhne.mezo.feature.companion.tools.ConversationContextTools.CONVERSATION_ID, conversation.getId());
        assertThat(contextTools.conversationHistory(4, 0, new org.springframework.ai.chat.model.ToolContext(ctx)))
                .contains("csillagközi kertészet", "Nincs régebbi oldal");
        ctx.put(io.mrkuhne.mezo.feature.companion.tools.ToolContexts.USER_ID, other);
        assertThat(contextTools.conversationHistory(4, 0, new org.springframework.ai.chat.model.ToolContext(ctx)))
                .isEqualTo("nincs adat");
    }

    @Test
    void testSendMessage_shouldLoadOnlyRequestedContext_whenSnapshotIsNotNeeded() {
        UUID user = users.populateUser("free-context@test.local");
        var conversation = conversations.conversation(user);
        var answer = chatService.sendMessage(user, conversation.getId(), request("Mit tudsz rólam? "
                + "[fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"get_personal_context\","
                + "\"args\":{\"scope\":\"facts\"},\"why\":\"háttér\"}]}]"));
        assertThat(answer.getTools()).hasSize(1);
        assertThat(answer.getContent()).doesNotContain("AKTUÁLIS ÁLLAPOT", "ÚJ FELISMERÉSEK");
    }

    @Test
    void testSendMessage_shouldDiscloseOnlyOwnersMemories_whenMemoryIsRequested() {
        UUID user = users.populateUser("free-memory@test.local");
        UUID other = users.populateUser("free-memory-other@test.local");
        var conversation = conversations.conversation(user);
        String query = "kirándulás";
        float[] vector = embeddings.embedQuery(query);
        memories.embedding(user, "journal_entry", UUID.randomUUID(), "Saját kirándulás a hegyre.",
                LocalDate.now().minusDays(2), vector);
        memories.embedding(other, "journal_entry", UUID.randomUUID(), "IDEGEN TITKOS kirándulás.",
                LocalDate.now().minusDays(2), vector);
        var answer = chatService.sendMessage(user, conversation.getId(), request("Emlékszel rá? "
                + "[fake-plan:{\"needsData\":true,\"steps\":[{\"tool\":\"search_personal_memory\","
                + "\"args\":{\"query\":\"kirándulás\"},\"why\":\"emlék\"}]}]"));
        assertThat(answer.getContent()).contains("Saját kirándulás").doesNotContain("IDEGEN TITKOS");
        assertThat(answer.getRecalled()).isNotEmpty();
        assertThat(messageRepository.findById(answer.getId()).orElseThrow().getRecalledMemories()).isNotNull();
    }

    @Test
    void testStreamMessage_shouldNotPersistPartialAssistant_whenProviderStreamFails() {
        UUID user = users.populateUser("free-stream-fail@test.local");
        var conversation = conversations.conversation(user);
        var events = streamService.streamMessage(user, conversation.getId(), request("[fake-stream-fail]"))
                .collectList().block(Duration.ofSeconds(30));
        assertThat(events.getLast().event()).isEqualTo("error");
        assertThat(messageRepository.findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
                conversation.getId(), user)).extracting(AiMessageEntity::getRole).containsExactly("user");
    }
}
