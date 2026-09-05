package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.MessageTool;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.api.dto.StreamToolCall;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiConversationRepository;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.feature.companion.service.ConversationService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Streamed chat turn against the fake LLM — event protocol (delta/done/error) + the
 * two-transaction persistence semantics. Deliberately NOT @Transactional: the streamed
 * path runs prepareTurn and completeTurn in separate transactions through the proxy,
 * and this test observes exactly that (cleanup is the per-test ResetDatabase).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.serving-mode=OLD")
class ChatStreamServiceIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private ConversationService conversationService;
    @Autowired private AiConversationRepository conversationRepository;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;

    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    @Test
    void testStreamMessage_shouldCarryToolChipsOnDoneAndPersistEnvelope_whenScriptedToolRuns() {
        UUID userId = databasePopulator.populateUser("stream-tools@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"))
                .collectList().block();

        ServerSentEvent<Object> done = events.getLast();
        assertThat(done.event()).isEqualTo("done");
        MessageResponse resp = (MessageResponse) done.data();
        assertThat(resp.getTools()).extracting(MessageTool::getName).containsExactly("get_recovery(scope=sleep, days=3)");
        assertThat(resp.getRefs()).isNotEmpty();

        AiMessageEntity assistant = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(
                        conversation.getId(), userId)
                .getLast();
        assertThat(assistant.getToolCalls().calls()).hasSize(1);
        assertThat(assistant.getToolCalls().calls().getFirst().name()).isEqualTo("get_recovery");
    }

    @Test
    void testStreamMessage_shouldEmitDeltasThenDoneAndPersistBothRows_whenLlmStreams() {
        UUID userId = databasePopulator.populateUser("stream-happy@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("mi a mai terv?"))
                .collectList().block();

        assertThat(events).isNotEmpty();
        assertThat(events.subList(0, events.size() - 1))
                .allSatisfy(e -> {
                    assertThat(e.event()).isEqualTo("delta");
                    assertThat(e.data()).isInstanceOf(StreamDelta.class);
                });
        String joined = events.stream().limit(events.size() - 1)
                .map(e -> ((StreamDelta) e.data()).getText()).reduce("", String::concat);
        assertThat(joined).startsWith(FakeCompanionLlm.PREFIX).contains("user=[mi a mai terv?]");

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("done");
        MessageResponse done = (MessageResponse) last.data();
        assertThat(done.getRole()).isEqualTo("assistant");
        assertThat(done.getContent()).isEqualTo(joined);

        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());
        assertThat(messages).hasSize(2);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
        assertThat(messages.getFirst().getContent()).isEqualTo("mi a mai terv?");
        assertThat(messages.getLast().getContent()).isEqualTo(joined);

        AiConversationEntity touched = conversationRepository.findById(conversation.getId()).orElseThrow();
        assertThat(touched.getTitle()).isEqualTo("mi a mai terv?");
        assertThat(touched.getLastMessageAt()).isNotNull();
    }

    @Test
    void testStreamMessage_shouldEmitErrorAndKeepOnlyUserRow_whenLlmStreamFails() {
        UUID userId = databasePopulator.populateUser("stream-error@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("szállj el " + FakeCompanionLlm.FAIL_STREAM))
                .collectList().block();

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("error");
        assertThat(((StreamError) last.data()).getCode()).isEqualTo("COMPANION_STREAM_FAILED");

        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());
        assertThat(messages).hasSize(1); // partial answers are NEVER persisted
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
    }

    @Test
    void testStreamMessage_shouldEmitEmptyAnswerErrorAndKeepOnlyUserRow_whenModelReturnsNoText() {
        UUID userId = databasePopulator.populateUser("stream-empty@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("mennyi a súlyom " + FakeCompanionLlm.EMPTY_ANSWER))
                .collectList().block();

        ServerSentEvent<Object> last = events.getLast();
        assertThat(last.event()).isEqualTo("error");
        assertThat(((StreamError) last.data()).getCode()).isEqualTo("COMPANION_EMPTY_ANSWER");

        // The blank answer is NOT a row: it would render as an empty card and then poison the
        // next turn's history as an empty AssistantMessage (mezo-8z79).
        List<MessageResponse> messages = conversationService.listMessages(userId, conversation.getId());
        assertThat(messages).hasSize(1);
        assertThat(messages.getFirst().getRole()).isEqualTo("user");
    }

    @Test
    void testStreamMessage_shouldThrow404BeforeStreaming_whenConversationForeign() {
        UUID userId = databasePopulator.populateUser("stream-foreign@test.local");

        assertThatThrownBy(() -> chatStreamService.streamMessage(
                userId, UUID.randomUUID(), request("x")))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testStreamMessage_shouldEmitToolEventBeforeDone_whenScriptedToolRuns() {
        UUID userId = databasePopulator.populateUser("stream-tool-event@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"))
                .collectList().block();

        // the live 'tool' event carries the SAME pre-baked label as the done row's chip, so the FE
        // renders a live chip and a final chip through one component
        List<ServerSentEvent<Object>> toolEvents = events.stream()
                .filter(e -> "tool".equals(e.event())).toList();
        assertThat(toolEvents).singleElement().satisfies(e -> {
            StreamToolCall data = (StreamToolCall) e.data();
            assertThat(data.getName()).isEqualTo("get_recovery(scope=sleep, days=3)");
            assertThat(data.getType()).isEqualTo("read");
        });
        // The premise of mezo-280: the chip appears WHILE the answer streams. Pinning the tool frame
        // ahead of the LAST delta — not merely ahead of 'done' — is what rules out the very
        // behaviour this feature exists to kill: buffering every tool event and flushing the lot
        // immediately before the terminal row.
        int lastDeltaIndex = IntStream.range(0, events.size())
                .filter(i -> "delta".equals(events.get(i).event()))
                .max().orElseThrow();
        assertThat(events.indexOf(toolEvents.getFirst())).isLessThan(lastDeltaIndex);
        assertThat(events.getLast().event()).isEqualTo("done");
        assertThat(((MessageResponse) events.getLast().data()).getTools())
                .extracting(MessageTool::getName).containsExactly("get_recovery(scope=sleep, days=3)");
    }

    @Test
    void testStreamMessage_shouldEmitBareToolNameWithoutParentheses_whenToolRunsWithoutArgs() {
        UUID userId = databasePopulator.populateUser("stream-tool-noargs@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("aludtam eleget? [fake-tool:get_recovery]"))
                .collectList().block();

        // no JSON argument object -> compactArgs("{}") == "" -> the label is the BARE tool name
        assertThat(events).filteredOn(e -> "tool".equals(e.event()))
                .singleElement()
                .satisfies(e -> assertThat(((StreamToolCall) e.data()).getName()).isEqualTo("get_recovery"));
        // and the done row's chip takes the same branch — the live and final labels stay twins
        assertThat(((MessageResponse) events.getLast().data()).getTools())
                .extracting(MessageTool::getName).containsExactly("get_recovery");
    }

    @Test
    void testStreamMessage_shouldEmitNoToolEvents_whenTurnRunsNoTools() {
        UUID userId = databasePopulator.populateUser("stream-no-tool-event@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("mi a mai terv?"))
                .collectList().block();

        assertThat(events).noneMatch(e -> "tool".equals(e.event()));
        assertThat(events.getLast().event()).isEqualTo("done");
    }

    @Test
    void testStreamMessage_shouldPassHistoryAsPriorMessages_whenPriorTurnsExist() {
        UUID userId = databasePopulator.populateUser("stream-history@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        messagePopulator.message(conversation, AiMessageEntity.ROLE_USER, "korábbi kérdés");

        // A delta-eseményekből összefűzött teljes szöveg — a fájl meglévő mintája szerint.
        String streamed = collectDeltas(userId, conversation.getId(), "és most?");

        String systemBlock = streamed.substring(streamed.indexOf("system=["), streamed.indexOf("] history=["));
        String historyBlock = streamed.substring(streamed.indexOf("history=["), streamed.indexOf("] user=["));
        assertThat(systemBlock).doesNotContain("Felhasználó: korábbi kérdés");
        assertThat(historyBlock).contains("Felhasználó: korábbi kérdés");
    }

    @Test
    void testStreamMessage_shouldEndPromptWithToneReminder_whenAssemblingPrompt() {
        UUID userId = databasePopulator.populateUser("stream-tone-tail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);

        // mezo-q71s: prepareTurn (the STREAMED assembly site) must carry the same recency
        // counterweight as sendMessage — a mismatch between the two paths is a real bug that
        // ChatServiceIT's sync-only coverage would not catch.
        String streamed = collectDeltas(userId, conversation.getId(), "szia");

        String systemBlock = streamed.substring(streamed.indexOf("system=["), streamed.indexOf("] history=["));
        String toneReminder = ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "stream-tone-tail@test.local");
        assertThat(systemBlock.indexOf(toneReminder))
                .isGreaterThan(systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK"));
        assertThat(systemBlock).endsWith(toneReminder);
    }

    @Test
    void testStreamMessage_shouldInjectMemoriesBlockAndCarryMemoryRefsOnDone_whenSimilarMemoriesExist() {
        UUID userId = databasePopulator.populateUser("stream-memories@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        factPopulator.fact(userId, "Laktózérzékeny", "health", 2);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(), request("[fake-embed:1] hogy aludtam futás után?"))
                .collectList().block();

        // prepareTurn is the STREAMED assembly site — it must carry the same block as sendMessage
        String streamed = events.stream()
                .filter(e -> "delta".equals(e.event()))
                .map(e -> ((StreamDelta) e.data()).getText())
                .reduce("", String::concat);
        String systemBlock = streamed.substring(streamed.indexOf("system=["), streamed.indexOf("] history=["));
        assertThat(systemBlock.indexOf(PromptMemoryAssembler.MEMORIES_HEADER))
                .isGreaterThan(systemBlock.indexOf("MEGERŐSÍTETT TÉNYEK"));
        assertThat(systemBlock).contains("(napló): futás után jobban aludtam");
        assertThat(systemBlock).endsWith(ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "stream-memories@test.local"));

        MessageResponse done = (MessageResponse) events.getLast().data();
        assertThat(done.getRefs()).extracting(MessageRef::getKind, MessageRef::getId)
                .contains(Tuple.tuple("Memory", LocalDate.now().minusDays(3).toString()));
        AiMessageEntity assistant = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId)
                .getLast();
        assertThat(assistant.getRefs().refs()).extracting(r -> r.kind()).contains("Memory");
        // W3.1b (mezo-b3pp.28): the streamed twin of the sync disclosure — the terminal 'done' row
        // carries the recalled memories, and the same envelope is on the committed assistant row
        assertThat(done.getRecalled()).singleElement().satisfies(item -> {
            assertThat(item.getOccurredOn()).isEqualTo(LocalDate.now().minusDays(3));
            assertThat(item.getLabel()).isEqualTo("napló");
            assertThat(item.getGist()).isEqualTo("futás után jobban aludtam");
        });
        assertThat(assistant.getRecalledMemories().items())
                .extracting(RecalledMemoriesEnvelope.Item::label, RecalledMemoriesEnvelope.Item::gist)
                .containsExactly(Tuple.tuple("napló", "futás után jobban aludtam"));
    }

    @Test
    void testStreamMessage_shouldKeepToolRefsAheadOfMemoryRefs_whenBothPresent() {
        UUID userId = databasePopulator.populateUser("stream-memories-order@test.local");
        sleepLogPopulator.createSleepLog(userId, LocalDate.now(), new BigDecimal("7.0"), 3);
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("[fake-embed:1] aludtam eleget? [fake-tool:get_recovery {\"scope\":\"sleep\",\"days\":3}]"))
                .collectList().block();

        // the streamed twin of ChatServiceAmbientRecallIT's ordering test: the ambient refs are
        // added after the tool loop AND the advisor review, so tool refs keep the cap priority
        MessageResponse done = (MessageResponse) events.getLast().data();
        List<String> kinds = done.getRefs().stream().map(MessageRef::getKind).toList();
        assertThat(kinds).contains("Sleep", "Memory");
        assertThat(kinds.indexOf("Memory")).isGreaterThan(kinds.lastIndexOf("Sleep"));
        assertThat(kinds.getLast()).isEqualTo("Memory");
    }

    /** The delta text, concatenated in order — the same map+reduce the happy-path test above uses,
     *  filtered by event type instead of by index so a scripted 'tool' event never sneaks in. */
    private String collectDeltas(UUID userId, UUID conversationId, String content) {
        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversationId, request(content))
                .collectList().block();
        return events.stream()
                .filter(e -> "delta".equals(e.event()))
                .map(e -> ((StreamDelta) e.data()).getText())
                .reduce("", String::concat);
    }
}
