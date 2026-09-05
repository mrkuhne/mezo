package io.mrkuhne.mezo.feature.companion;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.RecalledMemory;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** NEW-mode chat wiring: one shared context and identical disclosure on sync and SSE paths. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true",
    "mezo.companion.memory-platform.serving-mode=NEW"
})
class ChatMemoryRolloutIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final String QUERY = "Mit tudunk Boglárkáról? [fake-embed:1]";

    @Autowired private ChatService chatService;
    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;

    @Test
    void testSendMessage_shouldServeUnifiedContextAndStableDisclosureIds_whenModeIsNew() {
        UUID owner = databasePopulator.populateUser("chat-memory-new-sync@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        MemoryItemEntity memory = memory(owner, "Boglárka után jobban aludtam. [fake-embed:1]");

        MessageResponse response = chatService.sendMessage(owner, conversation.getId(), request(QUERY));

        assertUnifiedPrompt(response.getContent(), memory.getContent());
        assertStableDisclosure(response, owner, memory);
    }

    @Test
    void testStreamMessage_shouldServeSameUnifiedDisclosure_whenModeIsNew() {
        UUID owner = databasePopulator.populateUser("chat-memory-new-stream@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        MemoryItemEntity memory = memory(owner, "Boglárka után jobban aludtam. [fake-embed:1]");

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(owner, conversation.getId(), request(QUERY))
                .collectList().block();

        String streamed = events.stream()
                .filter(event -> "delta".equals(event.event()))
                .map(event -> ((io.mrkuhne.mezo.api.dto.StreamDelta) event.data()).getText())
                .reduce("", String::concat);
        MessageResponse done = (MessageResponse) events.getLast().data();
        assertUnifiedPrompt(streamed, memory.getContent());
        assertStableDisclosure(done, owner, memory);
    }

    @Test
    void testSendMessage_shouldNeverRetrieveAnotherUsersMemory_whenModeIsNew() {
        UUID ownerA = databasePopulator.populateUser("chat-memory-new-a@test.local");
        UUID ownerB = databasePopulator.populateUser("chat-memory-new-b@test.local");
        memory(ownerA, "A-TITKOS-Boglárka [fake-embed:1]");
        AiConversationEntity conversationB = conversationPopulator.conversation(ownerB);

        MessageResponse response = chatService.sendMessage(ownerB, conversationB.getId(), request(QUERY));

        assertThat(response.getContent()).doesNotContain("A-TITKOS-Boglárka");
        assertThat(response.getRecalled()).isEmpty();
        assertThat(runRepository.findAll()).filteredOn(run -> ownerB.equals(run.getCreatedBy()))
                .allSatisfy(run -> assertThat(run.getCreatedBy()).isEqualTo(ownerB));
    }

    @Test
    void testSendMessage_shouldKeepLexicalMemoryAndAuditDenseFailure_whenEmbeddingFails() {
        UUID owner = databasePopulator.populateUser("chat-memory-new-embed-fail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        MemoryItemEntity memory = memory(owner, "Boglárka segített a költözésben.");

        MessageResponse response = chatService.sendMessage(owner, conversation.getId(),
                request("Boglárka " + FakeEmbeddingAdapter.FAIL_EMBED));

        assertUnifiedPrompt(response.getContent(), memory.getContent());
        RecalledMemory disclosed = response.getRecalled().stream()
                .filter(item -> memory.getId().equals(item.getMemoryItemId())).findFirst().orElseThrow();
        MemoryRetrievalRunEntity run = runRepository.findById(disclosed.getRetrievalRunId()).orElseThrow();
        assertThat(run.getCreatedBy()).isEqualTo(owner);
        assertThat(((java.util.Map<?, ?>) run.getRetrieverTrace().get("dense")).containsKey("error"))
                .isTrue();
    }

    private MemoryItemEntity memory(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Boglárka napló", content, LocalDate.now().minusDays(4), new String[]{"Boglárka"},
                new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        return item;
    }

    private static SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    private static void assertUnifiedPrompt(String echoed, String memoryContent) {
        String system = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        assertThat(system).contains("[Hosszú távú memória]", memoryContent);
        assertThat(system).doesNotContain(PromptMemoryAssembler.MEMORIES_HEADER,
                GraphPromptAssembler.CONNECTIONS_HEADER, "MEGERŐSÍTETT TÉNYEK");
    }

    private void assertStableDisclosure(MessageResponse response, UUID owner, MemoryItemEntity memory) {
        assertThat(response.getRecalled()).filteredOn(item -> memory.getId().equals(item.getMemoryItemId()))
                .singleElement().satisfies(item -> {
                    assertThat(item.getRetrievalRunId()).isNotNull();
                    assertThat(item.getRetrievalResultId()).isNotNull();
                    assertThat(item.getIndicator()).isNotNull();
                    assertThat(item.getSimilarity()).isPositive();
                    MemoryRetrievalRunEntity run = runRepository.findById(item.getRetrievalRunId()).orElseThrow();
                    assertThat(run.getCreatedBy()).isEqualTo(owner);
                    assertThat(run.getServingMode()).isEqualTo("NEW");
                });
        RecalledMemory disclosed = response.getRecalled().stream()
                .filter(item -> memory.getId().equals(item.getMemoryItemId())).findFirst().orElseThrow();
        assertThat(disclosed.getOccurredOn()).isEqualTo(memory.getOccurredOn());
    }
}
