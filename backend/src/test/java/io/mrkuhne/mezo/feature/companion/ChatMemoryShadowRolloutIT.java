package io.mrkuhne.mezo.feature.companion;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/** SHADOW mode must serve legacy output while the unified retrieval runs only for audit. */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.companion.memory-platform.serving-mode=SHADOW"
})
class ChatMemoryShadowRolloutIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final String CONTENT = "futás után jobban aludtam [fake-embed:1]";
    private static final String QUERY = "[fake-embed:1] hogy aludtam futás után?";

    @Autowired private ChatService chatService;
    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryEmbeddingPopulator legacyEmbeddingPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;

    @Test
    void testSendMessage_shouldServeLegacyPromptAndPersistShadowRun_whenModeIsShadow() {
        UUID owner = databasePopulator.populateUser("chat-memory-shadow-sync@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        seedBothStores(owner);

        MessageResponse response = chatService.sendMessage(owner, conversation.getId(), request());

        assertLegacyResponse(response);
        awaitShadowRun(owner);
    }

    @Test
    void testStreamMessage_shouldServeLegacyDoneAndPersistShadowRun_whenModeIsShadow() {
        UUID owner = databasePopulator.populateUser("chat-memory-shadow-stream@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        seedBothStores(owner);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(owner, conversation.getId(), request()).collectList().block();

        MessageResponse done = (MessageResponse) events.getLast().data();
        assertLegacyResponse(done);
        awaitShadowRun(owner);
    }

    private void seedBothStores(UUID owner) {
        LocalDate occurredOn = LocalDate.now().minusDays(3);
        legacyEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY,
                UUID.randomUUID(), CONTENT, occurredOn, axisVector(0));
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", CONTENT, occurredOn, new String[]{"futás"}, new String[0],
                MemoryProvenanceEnvelope.empty());
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }

    private static SendMessageRequest request() {
        return SendMessageRequest.builder().content(QUERY).build();
    }

    private static void assertLegacyResponse(MessageResponse response) {
        assertThat(response.getContent()).contains(PromptMemoryAssembler.MEMORIES_HEADER)
                .doesNotContain("[Hosszú távú memória]");
        assertThat(response.getRecalled()).isNotEmpty().allSatisfy(item -> {
            assertThat(item.getRetrievalRunId()).isNull();
            assertThat(item.getRetrievalResultId()).isNull();
            assertThat(item.getMemoryItemId()).isNull();
            assertThat(item.getIndicator()).isNull();
        });
    }

    private void awaitShadowRun(UUID owner) {
        await().atMost(Duration.ofSeconds(10)).untilAsserted(() ->
                assertThat(runRepository.findAll())
                        .filteredOn(run -> owner.equals(run.getCreatedBy()))
                        .anySatisfy(run -> assertThat(run.getServingMode()).isEqualTo("SHADOW")));
    }
}
