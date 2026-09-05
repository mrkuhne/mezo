package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * W3.1 (mezo-b3pp.12): the {@code [Emlékek]} ambient-recall block on the SYNC chat path — prompt
 * position, the Memory refs on the wire and on the persisted row, ref ordering against tool refs,
 * and both failure modes (embed hop down, ANN statement failing at the DB).
 *
 * <p>Split out of {@link ChatServiceIT} and deliberately NOT {@code @Transactional}: these tests
 * assert that a turn COMMITS — both message rows on disk after a failed ANN statement — which a
 * test-managed (always rolled back) transaction cannot show. The per-test ResetDatabase cleans up.
 *
 * <p>Because these turns really commit, the {@code AFTER_COMMIT} {@code @Async} listeners
 * ({@code TurnEmbeddingListener}, {@code FactExtractionListener}) actually fire here — so the
 * sentinel-carrying turn's OWN post-turn embed fails too, harmlessly, in its own transaction and
 * shows up as a warn line in the build log. That noise is expected; it lands after the assertions,
 * on another thread and another transaction, and cannot affect this or any other test.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.serving-mode=OLD")
class ChatServiceAmbientRecallIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    private AiMessageEntity lastAssistantRow(UUID conversationId, UUID userId) {
        return messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversationId, userId)
                .getLast();
    }

    @Test
    void testSendMessage_shouldInjectMemoriesBlockBetweenPatternAckAndToneReminder_whenSimilarMemoriesExist() {
        UUID userId = databasePopulator.populateUser("chat-memories@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);
        // a freshly promoted pattern-fact (createdAt = now) sits inside the ack window (3 days), so
        // the pattern-ack block is really present — otherwise "between pattern-ack and tone" would
        // only be pinning "after the facts block"
        factPopulator.fact(userId, "Stressz rontja az alvást", "health", 0, true, "pattern");
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request("[fake-embed:1] hogy aludtam futás után?"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        int facts = systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK");
        int ack = systemBlock.indexOf("ÚJ FELISMERÉSEK");
        int memories = systemBlock.indexOf(PromptMemoryAssembler.MEMORIES_HEADER);
        String toneReminder = ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-memories@test.local");
        int tone = systemBlock.indexOf(toneReminder);
        assertThat(facts).isPositive();
        assertThat(ack).isGreaterThan(facts);
        assertThat(memories).isGreaterThan(ack);
        assertThat(tone).isGreaterThan(memories);
        assertThat(systemBlock).contains("(napló): futás után jobban aludtam");
        assertThat(systemBlock).endsWith(toneReminder);
        // every recalled item is a Memory/date ref — on the wire and on the persisted row
        assertThat(answer.getRefs()).extracting(MessageRef::getKind, MessageRef::getId)
                .contains(Tuple.tuple("Memory", LocalDate.now().minusDays(3).toString()));
        assertThat(lastAssistantRow(conversation.getId(), userId).getRefs().refs())
                .contains(new RefsEnvelope.Ref("Memory", LocalDate.now().minusDays(3).toString()));
        assertThat(answer.getDegraded()).isFalse();
        // W3.1b (mezo-b3pp.28): the answer discloses WHICH memories it was given — on the wire…
        assertThat(answer.getRecalled()).singleElement().satisfies(item -> {
            assertThat(item.getOccurredOn()).isEqualTo(LocalDate.now().minusDays(3));
            assertThat(item.getKind()).isEqualTo(MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY);
            assertThat(item.getLabel()).isEqualTo("napló");
            assertThat(item.getGist()).isEqualTo("futás után jobban aludtam");
            assertThat(item.getSimilarity()).isCloseTo(1.0, within(1e-6));
        });
        // …and on the committed row, so history re-renders the same disclosure
        assertThat(lastAssistantRow(conversation.getId(), userId).getRecalledMemories().items())
                .extracting(RecalledMemoriesEnvelope.Item::occurredOn, RecalledMemoriesEnvelope.Item::kind,
                        RecalledMemoriesEnvelope.Item::label, RecalledMemoriesEnvelope.Item::gist)
                .containsExactly(Tuple.tuple(LocalDate.now().minusDays(3),
                        MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló", "futás után jobban aludtam"));
        // the USER row never carries a recall — the block belongs to the ANSWER
        assertThat(messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId)
                .getFirst().getRecalledMemories()).isNull();
    }

    @Test
    void testSendMessage_shouldOmitMemoriesBlockAndStayHealthy_whenEmbeddingFails() {
        UUID userId = databasePopulator.populateUser("chat-memories-fail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "lenne mit felidézni", LocalDate.now().minusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request(FakeEmbeddingAdapter.FAIL_EMBED + " hogy aludtam?"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        // IDENT-3: the block is simply absent — the turn is NOT degraded and the prompt shape is intact
        assertThat(systemBlock).doesNotContain("[Emlékek]");
        assertThat(systemBlock).endsWith(
                ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-memories-fail@test.local"));
        assertThat(answer.getDegraded()).isFalse();
        assertThat(answer.getRefs()).isEmpty();
        // W3.1b: a failed recall discloses nothing — [] on the wire, null on the row
        assertThat(answer.getRecalled()).isEmpty();
        assertThat(lastAssistantRow(conversation.getId(), userId).getRecalledMemories()).isNull();
        assertThat(messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId))
                .hasSize(2);
    }

    /**
     * The other half of IDENT-3, and the test that pins the savepoint scope of
     * {@code MemoryEmbeddingAnnQuery}: here the embed hop SUCCEEDS (returning a short vector) and
     * the ANN statement dies at the database instead. Without the savepoint the failure aborts the
     * turn's transaction outright ("current transaction is aborted, commands ignored…"), and the
     * very next query of the turn blows up — an optional memory block sinking a whole chat turn.
     */
    @Test
    void testSendMessage_shouldOmitMemoriesBlockAndStayHealthy_whenAnnQueryFails() {
        UUID userId = databasePopulator.populateUser("chat-memories-ann-fail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "lenne mit felidézni", LocalDate.now().minusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request(FakeEmbeddingAdapter.FAIL_ANN + " hogy aludtam?"));

        String echoed = answer.getContent();
        String systemBlock = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        assertThat(systemBlock).doesNotContain("[Emlékek]");
        assertThat(systemBlock).endsWith(
                ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-memories-ann-fail@test.local"));
        assertThat(answer.getDegraded()).isFalse();
        assertThat(answer.getRefs()).isEmpty();
        assertThat(answer.getRecalled()).isEmpty();
        assertThat(lastAssistantRow(conversation.getId(), userId).getRecalledMemories()).isNull();
        // both rows COMMITTED — the turn survived the failed ANN statement
        assertThat(messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId))
                .hasSize(2);
    }

    @Test
    void testSendMessage_shouldKeepToolRefsAheadOfMemoryRefs_whenBothPresent() {
        UUID userId = databasePopulator.populateUser("chat-memories-order@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse resp = chatService.sendMessage(userId, conversation.getId(),
                request("[fake-embed:1] aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"));

        // the answer's own provenance (tool refs) wins the per-turn ref cap; ambient refs follow
        List<String> kinds = resp.getRefs().stream().map(MessageRef::getKind).toList();
        assertThat(kinds).contains("Sleep", "Memory");
        assertThat(kinds.indexOf("Memory")).isGreaterThan(kinds.lastIndexOf("Sleep"));
        assertThat(kinds.getLast()).isEqualTo("Memory");
    }
}
