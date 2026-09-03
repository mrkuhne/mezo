package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W2.4 (mezo-b3pp.9): the [Összefüggések] block on the chat paths — position between [Emlékek]
 * and TONE_REMINDER, GraphNode refs after the Memory refs on the wire and on the row. Not
 * @Transactional (the ambient-recall IT's reasoning: these turns commit).
 */
@ActiveProfiles("companion-fake")
class ChatServiceGraphBlockIT extends AbstractIntegrationTest {

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;

    private static SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    private static String systemBlock(MessageResponse answer) {
        String echoed = answer.getContent();
        return echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
    }

    @Test
    void testSendMessage_shouldInjectConnectionsBlockBetweenMemoriesAndToneReminder_withGraphNodeRefs() {
        UUID userId = databasePopulator.populateUser("chat-graph@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");
        memoryEmbeddingPopulator.embedding(userId, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "futás után jobban aludtam", LocalDate.now().minusDays(3), MemoryEmbeddingPopulator.axisVector(0));

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                request("[fake-embed:1] miért rossz az alvás?"));

        String system = systemBlock(answer);
        int memories = system.indexOf(PromptMemoryAssembler.MEMORIES_HEADER);
        int connections = system.indexOf(GraphPromptAssembler.CONNECTIONS_HEADER);
        String toneReminder = ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-graph@test.local");
        int tone = system.indexOf(toneReminder);
        assertThat(memories).isPositive();
        assertThat(connections).isGreaterThan(memories);
        assertThat(tone).isGreaterThan(connections);
        assertThat(system).contains("- Késői evés → kiváltja → Rossz alvás · erős\n");
        assertThat(answer.getDegraded()).isFalse();
        // refs: Memory first (W3.1 order), then GraphNode — wire and row agree
        List<String> kinds = answer.getRefs().stream().map(MessageRef::getKind).toList();
        assertThat(kinds).containsExactly("Memory", "GraphNode", "GraphNode");
        assertThat(answer.getRefs()).extracting(MessageRef::getId)
                .contains(a.getId().toString(), b.getId().toString());
        AiMessageEntity row = messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId)
                .getLast();
        // mezo-b3pp.33: the persisted ref also carries the node's title as the label
        assertThat(row.getRefs().refs())
                .contains(new RefsEnvelope.Ref("GraphNode", a.getId().toString(), "Késői evés"));
    }

    @Test
    void testPrepareTurn_shouldCarryGraphRefsForTheStreamPath() {
        UUID userId = databasePopulator.populateUser("chat-graph-stream@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Stressz");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.500");

        ChatService.PreparedTurn turn = chatService.prepareTurn(userId, conversation.getId(),
                request("a stressz mit csinál velem?"));

        assertThat(turn.systemPrompt()).contains(GraphPromptAssembler.CONNECTIONS_HEADER);
        assertThat(turn.systemPrompt()).endsWith(ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-graph-stream@test.local"));
        // mezo-b3pp.33: each ref carries its node's title as the label
        assertThat(turn.recalledRefs()).containsExactly(
                new RefsEnvelope.Ref("GraphNode", a.getId().toString(), "Stressz"),
                new RefsEnvelope.Ref("GraphNode", b.getId().toString(), "Rossz alvás"));
    }

    @Test
    void testSendMessage_shouldOmitConnectionsBlock_whenNothingMatches() {
        UUID userId = databasePopulator.populateUser("chat-graph-none@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(), request("mi a mai terv?"));

        assertThat(systemBlock(answer)).doesNotContain("[Összefüggések]");
        assertThat(systemBlock(answer)).endsWith(ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-graph-none@test.local"));
        assertThat(answer.getRefs()).noneMatch(r -> "GraphNode".equals(r.getKind()));
    }
}
