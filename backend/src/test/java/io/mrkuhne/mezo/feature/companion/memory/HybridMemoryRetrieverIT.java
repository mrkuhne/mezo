package io.mrkuhne.mezo.feature.companion.memory;

import static io.mrkuhne.mezo.feature.companion.CompanionLlm.Role.USER;
import static io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy.CHAT_AMBIENT;
import static io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode.SELF_CONTAINED;
import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.CompanionLlm.Turn;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.DenseMemoryRetriever;
import io.mrkuhne.mezo.feature.companion.memory.service.FactMemoryRetriever;
import io.mrkuhne.mezo.feature.companion.memory.service.GraphMemoryRetriever;
import io.mrkuhne.mezo.feature.companion.memory.service.LexicalMemoryRetriever;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetriever;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/** Owner/state/validity boundary for the four independently failing hybrid retrievers. */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.feature.knowledge-graph.enabled=true"
})
class HybridMemoryRetrieverIT extends AbstractIntegrationTest {

    private static final LocalDate AS_OF = LocalDate.of(2026, 9, 4);
    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final String QUERY = "[fake-embed:1] Mit tudunk Boglárka alvásáról?";

    @Autowired private DenseMemoryRetriever dense;
    @Autowired private LexicalMemoryRetriever lexical;
    @Autowired private FactMemoryRetriever facts;
    @Autowired private GraphMemoryRetriever graph;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private AiMessagePopulator messagePopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryVectorRepository vectorRepository;
    @Autowired private KnowledgeFactRepository factRepository;
    @Autowired private GraphNodeRepository graphNodeRepository;
    @Autowired private NamedParameterJdbcTemplate jdbc;
    @Autowired private Map<String, MemoryRetriever> retrievers;

    @Test
    void testWiring_shouldExposeFourStableRetrieverBeanNames() {
        assertThat(retrievers).containsOnlyKeys("dense", "lexical", "facts", "graph");
    }

    @Test
    void testDenseRetrieve_shouldEnforceOwnerStateVersionValidityAsOfAndConversation() {
        UUID owner = databasePopulator.populateUser("hybrid-dense-owner@test.local");
        UUID other = databasePopulator.populateUser("hybrid-dense-other@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        AiMessageEntity currentTurn = messagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "Aktuális válasz");

        UUID semanticId = item(owner, "journal_entry", "A hosszú futás után mélyen aludtam.", AS_OF.minusDays(4), 0);
        UUID oldSalientId = item(owner, "reflection", "Régi, de fontos alvási felismerés.", AS_OF.minusYears(3), 0);
        MemoryItemEntity suppressed = itemEntity(owner, "journal_entry", "Elrejtett közeli találat.", AS_OF.minusDays(2), 0);
        suppressed.setState(MemoryItemEntity.STATE_SUPPRESSED);
        itemRepository.saveAndFlush(suppressed);
        MemoryItemEntity superseded = itemEntity(owner, "journal_entry", "Felülírt közeli találat.", AS_OF.minusDays(2), 0);
        superseded.setState(MemoryItemEntity.STATE_SUPERSEDED);
        itemRepository.saveAndFlush(superseded);
        MemoryItemEntity expired = itemEntity(owner, "journal_entry", "Lejárt közeli találat.", AS_OF.minusDays(2), 0);
        expired.setValidTo(AS_OF.minusDays(1));
        itemRepository.saveAndFlush(expired);
        MemoryItemEntity notYetValid = itemEntity(
                owner, "journal_entry", "Még nem érvényes közeli találat.", AS_OF.minusDays(2), 0);
        notYetValid.setValidFrom(AS_OF.plusDays(1));
        itemRepository.saveAndFlush(notYetValid);
        UUID futureId = item(owner, "journal_entry", "Jövőbeli közeli találat.", AS_OF.plusDays(1), 0);
        UUID otherId = item(other, "journal_entry", "Idegen közeli találat.", AS_OF.minusDays(1), 0);
        UUID wrongVersionId = item(owner, "journal_entry", "Másik generáció közeli találata.", AS_OF.minusDays(1), 0,
                "gemini-embedding-next-768-v2");
        MemoryItemEntity staleVector = itemEntity(
                owner, "journal_entry", "Elavult vektorgeneráció közeli találata.", AS_OF.minusDays(1), 0);
        staleVector.setContentHash("f".repeat(64));
        itemRepository.saveAndFlush(staleVector);
        MemoryItemEntity pendingVector = itemEntity(
                owner, "journal_entry", "Függő vektor közeli találata.", AS_OF.minusDays(1), 0);
        setVectorStatus(pendingVector, MemoryVectorEntity.STATUS_PENDING);
        MemoryItemEntity failedVector = itemEntity(
                owner, "journal_entry", "Hibás vektor közeli találata.", AS_OF.minusDays(1), 0);
        setVectorStatus(failedVector, MemoryVectorEntity.STATUS_FAILED);
        MemoryItemEntity deletedVector = itemEntity(
                owner, "journal_entry", "Törölt vektor közeli találata.", AS_OF.minusDays(1), 0);
        MemoryVectorEntity deleted = vectorFor(deletedVector);
        vectorRepository.delete(deleted);
        vectorRepository.flush();
        MemoryItemEntity current = memoryPopulator.item(owner, "chat_turn", currentTurn.getId(),
                "A jelenlegi beszélgetés ismétlése.", AS_OF);
        memoryPopulator.vector(current, VERSION, axisVector(0));

        explainDenseSeededQuery(owner);
        List<MemoryCandidate> result = dense.retrieve(input(owner, conversation.getId()));

        assertThat(result).extracting(MemoryCandidate::sourceId)
                .contains(semanticId, oldSalientId)
                .doesNotContain(suppressed.getSourceId(), superseded.getSourceId(), expired.getSourceId(),
                        notYetValid.getSourceId(), futureId, otherId, wrongVersionId,
                        staleVector.getSourceId(), pendingVector.getSourceId(), failedVector.getSourceId(),
                        deletedVector.getSourceId(), currentTurn.getId());
        assertThat(result).allSatisfy(candidate -> {
            assertThat(candidate.retriever()).isEqualTo("dense");
            assertThat(candidate.memoryItemId()).isNotNull();
            assertThat(candidate.sourceKind()).isNotBlank();
            assertThat(candidate.localScore()).isBetween(0.0, 1.0);
        });
    }

    @Test
    void testLexicalRetrieve_shouldReturnOnlyEligibleExactTermMatchesInStableOrder() {
        UUID owner = databasePopulator.populateUser("hybrid-lexical-owner@test.local");
        UUID other = databasePopulator.populateUser("hybrid-lexical-other@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        AiMessageEntity currentTurn = messagePopulator.message(
                conversation, AiMessageEntity.ROLE_USER, "Boglárka jelenlegi emléke.");
        UUID exactNameId = item(owner, "journal_entry", "Boglárka kedden segített a költözésben.", AS_OF.minusDays(2), 1);
        item(owner, "journal_entry", "Kedden kaptam segítséget a költözésben.", AS_OF.minusDays(1), 0);
        MemoryItemEntity suppressed = itemEntity(owner, "journal_entry", "Boglárka rejtett emléke.", AS_OF, 0);
        suppressed.setState(MemoryItemEntity.STATE_SUPPRESSED);
        itemRepository.saveAndFlush(suppressed);
        MemoryItemEntity superseded = itemEntity(owner, "journal_entry", "Boglárka felülírt emléke.", AS_OF, 0);
        superseded.setState(MemoryItemEntity.STATE_SUPERSEDED);
        itemRepository.saveAndFlush(superseded);
        MemoryItemEntity expired = itemEntity(owner, "journal_entry", "Boglárka lejárt emléke.", AS_OF, 0);
        expired.setValidTo(AS_OF.minusDays(1));
        itemRepository.saveAndFlush(expired);
        MemoryItemEntity notYetValid = itemEntity(owner, "journal_entry", "Boglárka korai emléke.", AS_OF, 0);
        notYetValid.setValidFrom(AS_OF.plusDays(1));
        itemRepository.saveAndFlush(notYetValid);
        UUID futureId = item(owner, "journal_entry", "Boglárka holnap érkezik.", AS_OF.plusDays(1), 0);
        UUID otherId = item(other, "journal_entry", "Boglárka idegen emléke.", AS_OF, 0);
        MemoryItemEntity current = memoryPopulator.item(owner, "chat_turn", currentTurn.getId(),
                "Boglárka jelenlegi emléke.", AS_OF);

        assertThat(lexical.retrieve(input(owner, conversation.getId(), "Boglárka")))
                .extracting(MemoryCandidate::sourceId)
                .containsExactly(exactNameId)
                .doesNotContain(suppressed.getSourceId(), superseded.getSourceId(), expired.getSourceId(),
                        notYetValid.getSourceId(), futureId, otherId, current.getSourceId());
    }

    @Test
    void testChatCandidates_shouldCarryConversationDiversityGroupAcrossDenseAndLexicalRetrieval() {
        UUID owner = databasePopulator.populateUser("hybrid-chat-diversity@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(owner);
        AiMessageEntity first = messagePopulator.message(
                conversation, AiMessageEntity.ROLE_USER, "Boglárka segített a futásban.");
        AiMessageEntity second = messagePopulator.message(
                conversation, AiMessageEntity.ROLE_ASSISTANT, "Boglárka és a futás összefügg.");
        MemoryItemEntity firstItem = memoryPopulator.item(owner, "chat_turn", first.getId(),
                "Boglárka segített a futásban. [fake-embed:1]", AS_OF);
        MemoryItemEntity secondItem = memoryPopulator.item(owner, "chat_turn", second.getId(),
                "Boglárka és a futás összefügg. [fake-embed:1]", AS_OF);
        memoryPopulator.vector(firstItem, VERSION, axisVector(0));
        memoryPopulator.vector(secondItem, VERSION, axisVector(0));

        assertThat(dense.retrieve(input(owner, null)).stream()
                .filter(candidate -> "chat_turn".equals(candidate.sourceKind())).toList())
                .hasSize(2)
                .allMatch(candidate -> conversation.getId().equals(candidate.diversityGroupId()));
        assertThat(lexical.retrieve(input(owner, null, "Boglárka futás")).stream()
                .filter(candidate -> "chat_turn".equals(candidate.sourceKind())).toList())
                .hasSize(2)
                .allMatch(candidate -> conversation.getId().equals(candidate.diversityGroupId()));
    }

    @Test
    void testFactRetrieve_shouldUnionPinnedAndMatchingActiveFacts() {
        UUID owner = databasePopulator.populateUser("hybrid-fact-owner@test.local");
        UUID other = databasePopulator.populateUser("hybrid-fact-other@test.local");
        KnowledgeFactEntity pinned = factForAsOf(owner, "A reggeli séta fontos szokásom.", 1);
        pinned.setPinned(true);
        factRepository.saveAndFlush(pinned);
        KnowledgeFactEntity matching = factForAsOf(owner, "Boglárka a testvérem.", 2);
        KnowledgeFactEntity conflicting = factForAsOf(
                owner, "A rokoni kapcsolatot korábban másként rögzítettem.", 2);
        matching.setConflictsWith(conflicting.getId());
        factRepository.saveAndFlush(matching);
        KnowledgeFactEntity superseded = factForAsOf(owner, "Boglárka a kollégám.", 5);
        superseded.setSupersededBy(matching.getId());
        factRepository.saveAndFlush(superseded);
        KnowledgeFactEntity expired = factForAsOf(owner, "Boglárka régi edzőm.", 4);
        expired.setValidFrom(AS_OF.minusDays(2));
        expired.setValidTo(AS_OF.minusDays(1));
        factRepository.saveAndFlush(expired);
        KnowledgeFactEntity optedOut = factForAsOf(owner, "Boglárka a szomszédom.", 9);
        optedOut.setIncludeInPrompt(false);
        factRepository.saveAndFlush(optedOut);
        KnowledgeFactEntity future = factPopulator.factAt(owner, "Boglárka a jövőbeli ismerősöm.", "life",
                AS_OF.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC));
        factForAsOf(other, "Boglárka az idegen felhasználó testvére.", 9);

        List<MemoryCandidate> result = facts.retrieve(input(owner, null));

        assertThat(result).extracting(MemoryCandidate::sourceId)
                .contains(pinned.getId(), matching.getId(), conflicting.getId())
                .doesNotContain(superseded.getId(), expired.getId(), optedOut.getId(), future.getId());
        assertThat(result.getFirst().sourceId()).isEqualTo(pinned.getId());
        assertThat(result).allMatch(candidate -> candidate.retriever().equals("facts"));
        assertThat(result).filteredOn(candidate -> candidate.sourceId().equals(matching.getId())
                        || candidate.sourceId().equals(conflicting.getId()))
                .allMatch(MemoryCandidate::conflicting)
                .allSatisfy(candidate -> {
                    UUID expectedPeer = candidate.sourceId().equals(matching.getId())
                            ? conflicting.getId() : matching.getId();
                    assertThat(candidate.conflictingWithId()).isEqualTo(expectedPeer);
                });

        assertThat(facts.retrieve(input(owner, null, "Boglárka", 2)))
                .extracting(MemoryCandidate::sourceId)
                .contains(pinned.getId(), matching.getId(), conflicting.getId());
    }

    @Test
    void testGraphRetrieve_shouldMapOwnerScopedNeighborhoodToStableEdgeCandidates() {
        UUID owner = databasePopulator.populateUser("hybrid-graph-owner@test.local");
        UUID other = databasePopulator.populateUser("hybrid-graph-other@test.local");
        GraphNodeEntity seed = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PERSON, "Boglárka");
        GraphNodeEntity sleep = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Jobb alvás");
        sleep.setOccurredOn(AS_OF);
        graphNodeRepository.saveAndFlush(sleep);
        GraphEdgeEntity edge = graphPopulator.createEdge(
                owner, seed.getId(), sleep.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.800");
        GraphNodeEntity future = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Boglárka jövője");
        future.setOccurredOn(AS_OF.plusDays(1));
        graphNodeRepository.saveAndFlush(future);
        GraphEdgeEntity futureEdge = graphPopulator.createEdge(
                owner, seed.getId(), future.getId(), GraphEdgeEntity.KIND_SUPPORTS, "1.000");
        GraphNodeEntity foreign = graphPopulator.createNode(other, GraphNodeEntity.KIND_PERSON, "Boglárka");
        graphPopulator.createEdge(other, foreign.getId(), foreign.getId(), GraphEdgeEntity.KIND_RELATES_TO, "1.000");

        List<MemoryCandidate> result = graph.retrieve(input(owner, null));

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().retriever()).isEqualTo("graph");
        assertThat(result.getFirst().stableId()).isEqualTo(edge.getId());
        assertThat(result.getFirst().sourceId()).isEqualTo(edge.getId());
        assertThat(result.getFirst().content()).contains("Boglárka", "Jobb alvás", "SUPPORTS");
        assertThat(result.getFirst().localScore()).isEqualTo(0.8);
        assertThat(result).extracting(MemoryCandidate::sourceId).doesNotContain(futureEdge.getId());
    }

    @Test
    void testJdbcRetrieverFailure_shouldPropagateAndLeaveOuterTransactionUsable() {
        UUID owner = databasePopulator.populateUser("hybrid-failure-owner@test.local");
        UUID itemId = item(owner, "journal_entry", "Boglárka segített.", AS_OF, 0);
        KnowledgeFactEntity fact = factForAsOf(owner, "Boglárka a testvérem.", 1);

        assertThatThrownBy(() -> dense.retrieve(input(owner, null, FakeEmbeddingAdapter.FAIL_ANN)))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> lexical.retrieve(input(owner, null, "Boglárka", -1)))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> facts.retrieve(input(owner, null, "Boglárka", -1)))
                .isInstanceOf(RuntimeException.class);

        assertThat(lexical.retrieve(input(owner, null, "Boglárka")))
                .extracting(MemoryCandidate::sourceId).containsExactly(itemId);
        assertThat(facts.retrieve(input(owner, null, "Boglárka")))
                .extracting(MemoryCandidate::sourceId).containsExactly(fact.getId());
    }

    private UUID item(UUID owner, String sourceKind, String content, LocalDate occurredOn, int axis) {
        return item(owner, sourceKind, content, occurredOn, axis, VERSION);
    }

    private KnowledgeFactEntity factForAsOf(UUID owner, String text, int reinforcementCount) {
        KnowledgeFactEntity fact = factPopulator.fact(owner, text, "life", reinforcementCount);
        fact.setValidFrom(AS_OF);
        return factRepository.saveAndFlush(fact);
    }

    private UUID item(UUID owner, String sourceKind, String content, LocalDate occurredOn, int axis,
                      String embeddingVersion) {
        return itemEntity(owner, sourceKind, content, occurredOn, axis, embeddingVersion).getSourceId();
    }

    private MemoryItemEntity itemEntity(UUID owner, String sourceKind, String content,
                                        LocalDate occurredOn, int axis) {
        return itemEntity(owner, sourceKind, content, occurredOn, axis, VERSION);
    }

    private MemoryItemEntity itemEntity(UUID owner, String sourceKind, String content,
                                        LocalDate occurredOn, int axis, String embeddingVersion) {
        MemoryItemEntity item = memoryPopulator.item(owner, sourceKind, UUID.randomUUID(),
                null, content, occurredOn, new String[] {"alvás"}, new String[0],
                io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, embeddingVersion, axisVector(axis));
        return item;
    }

    private MemoryVectorEntity vectorFor(MemoryItemEntity item) {
        return vectorRepository.findByOwnerItemAndVersionIncludingDeleted(
                item.getCreatedBy(), item.getId(), VERSION).orElseThrow();
    }

    private void setVectorStatus(MemoryItemEntity item, String status) {
        MemoryVectorEntity vector = vectorFor(item);
        vector.setStatus(status);
        vector.setEmbedding(null);
        vectorRepository.saveAndFlush(vector);
    }

    private static RetrievalInput input(UUID owner, UUID conversationId) {
        return input(owner, conversationId, QUERY);
    }

    private static RetrievalInput input(UUID owner, UUID conversationId, String rawQuery) {
        return input(owner, conversationId, rawQuery, 30);
    }

    private static RetrievalInput input(UUID owner, UUID conversationId, String rawQuery, int candidateLimit) {
        MemoryRequest request = new MemoryRequest(
                owner, CHAT_AMBIENT, rawQuery, List.of(new Turn(USER, "Korábbi kör")),
                AS_OF, 1200, conversationId, false);
        PreparedMemoryQuery query = new PreparedMemoryQuery(
                SELF_CONTAINED, rawQuery, rawQuery, Optional.empty(), Optional.empty());
        return new RetrievalInput(request, query, VERSION, candidateLimit);
    }

    /** Diagnostic only: execute the real join/filter shape without asserting planner choices. */
    private void explainDenseSeededQuery(UUID owner) {
        String sql = """
            explain (analyze, buffers)
            select i.id
            from memory_vector v
            join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
            where v.created_by = :userId and v.is_deleted = false and v.status = 'ready'
              and v.embedding_version = :version and i.is_deleted = false and i.state = 'active'
              and i.occurred_on <= :asOf
            order by v.embedding <=> cast(:queryVector as vector)
            limit 30
            """;
        List<String> plan = jdbc.queryForList(sql, Map.of(
                "userId", owner,
                "version", VERSION,
                "asOf", AS_OF,
                "queryVector", vectorLiteral(axisVector(0))), String.class);
        assertThat(plan).isNotEmpty();
    }

    private static String vectorLiteral(float[] vector) {
        StringBuilder literal = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) {
                literal.append(',');
            }
            literal.append(vector[i]);
        }
        return literal.append(']').toString();
    }
}
