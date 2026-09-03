package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.api.dto.MessageRef;
import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * W2.4 (mezo-b3pp.9) IDENT-3: a graph read that dies at the database must cost the turn its
 * {@code [Összefüggések]} block and NOTHING ELSE — the turn still commits both rows and
 * {@code degraded} stays {@code false}.
 *
 * <p>This is why the seed read lives in {@code GraphTraversalQuery} (raw JDBC under a savepoint)
 * and not on {@code GraphNodeRepository}: a Hibernate query failure marks the turn's transaction
 * rollback-only, after which {@code GraphPromptAssembler}'s catch → EMPTY would still lose the
 * turn at commit. The spy makes the seed read fail the way the DB would; the savepoint scoping
 * itself is pinned by the sibling {@code ChatServiceAmbientRecallIT} ANN case.
 *
 * <p>Own IT class on purpose — the {@code @MockitoSpyBean} forks the application context, and the
 * other graph ITs must keep the clean one. Not {@code @Transactional}: the point is that the turn
 * COMMITS, which a test-managed (always rolled back) transaction cannot show.
 */
@ActiveProfiles("companion-fake")
class ChatServiceGraphBlockFailureIT extends AbstractIntegrationTest {

    @MockitoSpyBean private GraphTraversalQuery traversalQuery;

    @Autowired private ChatService chatService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GraphPopulator graphPopulator;

    @Test
    void testSendMessage_shouldOmitConnectionsBlockAndStillCommitTheTurn_whenTheSeedReadFails() {
        UUID userId = databasePopulator.populateUser("chat-graph-fail@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);
        // a graph that WOULD render — so an absent block can only come from the failure
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");
        doThrow(new DataAccessResourceFailureException("boom")).when(traversalQuery).activeNodes(any());

        MessageResponse answer = chatService.sendMessage(userId, conversation.getId(),
                SendMessageRequest.builder().content("miért rossz az alvás?").build());

        String echoed = answer.getContent();
        String system = echoed.substring(echoed.indexOf("system=["), echoed.indexOf("] history=["));
        assertThat(system).doesNotContain(GraphPromptAssembler.CONNECTIONS_HEADER);
        assertThat(system).doesNotContain("[Összefüggések]");
        assertThat(system).endsWith(
                ChatService.TONE_REMINDER.replace(PromptPersona.NAME_TOKEN, "chat-graph-fail@test.local"));
        assertThat(answer.getDegraded()).isFalse();
        assertThat(answer.getRefs()).extracting(MessageRef::getKind)
                .doesNotContain(GraphPromptAssembler.REF_KIND);
        // the whole point: the user turn AND the assistant turn are on disk
        assertThat(messageRepository
                .findByConversationIdAndCreatedByAndDeletedFalseOrderByCreatedAtAsc(conversation.getId(), userId))
                .hasSize(2);
    }
}
