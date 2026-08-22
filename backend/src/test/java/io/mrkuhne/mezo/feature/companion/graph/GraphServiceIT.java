package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Service-level coverage for {@link GraphService}'s UPSERT primitives (bd mezo-b3pp.6 final-review
 * finding 4) — {@code upsertNode}/{@code upsertEdge} are the idempotent building blocks later
 * slices (W2.2, W2.3) call, but nothing exercised them before this class. Also carries the
 * regression test for finding 2 (edge unique index must exclude soft-deleted rows).
 */
class GraphServiceIT extends AbstractIntegrationTest {

    @Autowired private GraphService service;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testUpsertNode_shouldUpdateInPlace_whenSameSourceKindAndSourceIdCalledTwice() {
        UUID owner = ownerId();
        UUID sourceId = UUID.randomUUID();

        service.upsertNode(owner, GraphNodeEntity.KIND_PATTERN, "Első cím.", null,
            "pattern", sourceId, null, null);
        GraphNodeEntity second = service.upsertNode(owner, GraphNodeEntity.KIND_PATTERN, "Második cím.",
            null, "pattern", sourceId, null, null);

        assertThat(nodeRepository.count()).isEqualTo(1);
        assertThat(second.getTitle()).isEqualTo("Második cím.");
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(owner, "pattern", sourceId))
            .get().extracting(GraphNodeEntity::getTitle).isEqualTo("Második cím.");
    }

    @Test
    void testUpsertNode_shouldAlwaysInsert_whenSourceKindAndSourceIdBothNull() {
        UUID owner = ownerId();

        service.upsertNode(owner, GraphNodeEntity.KIND_INSIGHT, "Első.", null, null, null, null, null);
        service.upsertNode(owner, GraphNodeEntity.KIND_INSIGHT, "Második.", null, null, null, null, null);

        // No natural key to match on without sourceKind/sourceId, so every call inserts — this is
        // the current, accepted behavior (documented here, not changed).
        assertThat(nodeRepository.count()).isEqualTo(2);
    }

    @Test
    void testUpsertEdge_shouldUpdateInPlace_whenSameFromToKindCalledTwice() {
        UUID owner = ownerId();
        GraphNodeEntity from = nodeRepository.saveAndFlush(newNode(owner, "A"));
        GraphNodeEntity to = nodeRepository.saveAndFlush(newNode(owner, "B"));

        service.upsertEdge(owner, from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS,
            new BigDecimal("0.200"), null);
        GraphEdgeEntity second = service.upsertEdge(owner, from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS,
            new BigDecimal("0.800"), null);

        assertThat(edgeRepository.count()).isEqualTo(1);
        assertThat(second.getWeight()).isEqualByComparingTo(new BigDecimal("0.800"));
    }

    /**
     * Regression test for final-review finding 2: {@code uq_knowledge_edge_pair} must be a
     * partial index excluding {@code is_deleted = true} rows, or re-upserting an edge whose prior
     * incarnation was soft-deleted (W2.5 decay) throws {@code DataIntegrityViolationException}
     * even though {@link GraphService#upsertEdge}'s own finder never sees the deleted row.
     */
    @Test
    void testUpsertEdge_shouldSucceed_whenSameFromToKindPreviouslySoftDeleted() {
        UUID owner = ownerId();
        GraphNodeEntity from = nodeRepository.saveAndFlush(newNode(owner, "A"));
        GraphNodeEntity to = nodeRepository.saveAndFlush(newNode(owner, "B"));

        GraphEdgeEntity edge = service.upsertEdge(owner, from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS,
            new BigDecimal("0.100"), null);
        edgeRepository.delete(edge); // @SQLDelete -> UPDATE ... set is_deleted = true
        edgeRepository.flush();

        assertThatCode(() -> service.upsertEdge(owner, from.getId(), to.getId(), GraphEdgeEntity.KIND_TRIGGERS,
            new BigDecimal("0.500"), null))
            .doesNotThrowAnyException();
        assertThat(edgeRepository.count()).isEqualTo(1); // the one active row post re-upsert
    }

    private GraphNodeEntity newNode(UUID owner, String title) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(GraphNodeEntity.KIND_PATTERN);
        n.setTitle(title);
        return n;
    }
}
