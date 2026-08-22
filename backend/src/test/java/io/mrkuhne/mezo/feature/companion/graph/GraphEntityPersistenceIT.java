package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

class GraphEntityPersistenceIT extends AbstractIntegrationTest {

    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testSaveNode_shouldPersistWithDefaultsAndMeta_whenValid() {
        UUID owner = ownerId();
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(owner);
        node.setKind(GraphNodeEntity.KIND_PATTERN);
        node.setTitle("Késői evés rontja az alvást");
        node.setSummary("r=0.42, n=18, 30 nap.");
        node.setMeta(Map.of("r", 0.42, "n", 18));

        GraphNodeEntity saved = nodeRepository.saveAndFlush(node);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(saved.isDeleted()).isFalse();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getMeta()).containsEntry("n", 18);
    }

    @Test
    void testSaveNode_shouldReject_whenKindNotInCheckSet() {
        UUID owner = ownerId();
        GraphNodeEntity node = new GraphNodeEntity();
        node.setCreatedBy(owner);
        node.setKind("BOGUS");
        node.setTitle("x");

        assertThatThrownBy(() -> nodeRepository.saveAndFlush(node))
            .isInstanceOf(Exception.class);
    }

    @Test
    void testSaveNode_shouldRejectDuplicateSource_whenSameCreatedByAndSourceKindAndSourceId() {
        UUID owner = ownerId();
        UUID sourceId = UUID.randomUUID();
        GraphNodeEntity first = new GraphNodeEntity();
        first.setCreatedBy(owner);
        first.setKind(GraphNodeEntity.KIND_PATTERN);
        first.setTitle("Első.");
        first.setSourceKind("pattern");
        first.setSourceId(sourceId);
        nodeRepository.saveAndFlush(first);

        GraphNodeEntity duplicate = new GraphNodeEntity();
        duplicate.setCreatedBy(owner);
        duplicate.setKind(GraphNodeEntity.KIND_PATTERN);
        duplicate.setTitle("Második, ugyanaz a forrás.");
        duplicate.setSourceKind("pattern");
        duplicate.setSourceId(sourceId);

        assertThatThrownBy(() -> nodeRepository.saveAndFlush(duplicate))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void testSaveEdge_shouldPersistWithEvidenceAndDefaultWeight_whenValid() {
        UUID owner = ownerId();
        GraphNodeEntity from = nodeRepository.saveAndFlush(newNode(owner, "A"));
        GraphNodeEntity to = nodeRepository.saveAndFlush(newNode(owner, "B"));

        GraphEdgeEntity edge = new GraphEdgeEntity();
        edge.setCreatedBy(owner);
        edge.setFromNodeId(from.getId());
        edge.setToNodeId(to.getId());
        edge.setKind(GraphEdgeEntity.KIND_TRIGGERS);
        edge.setEvidence(List.of(new GraphEdgeEvidence("pattern", from.getId(), "confirm", Instant.now())));

        GraphEdgeEntity saved = edgeRepository.saveAndFlush(edge);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getWeight()).isEqualByComparingTo(new BigDecimal("0.500"));
        assertThat(saved.getEvidence()).hasSize(1);
    }

    @Test
    void testSaveEdge_shouldRejectDuplicatePair_whenSameFromToKind() {
        UUID owner = ownerId();
        GraphNodeEntity from = nodeRepository.saveAndFlush(newNode(owner, "A"));
        GraphNodeEntity to = nodeRepository.saveAndFlush(newNode(owner, "B"));
        edgeRepository.saveAndFlush(newEdge(owner, from.getId(), to.getId()));

        assertThatThrownBy(() -> edgeRepository.saveAndFlush(newEdge(owner, from.getId(), to.getId())))
            .isInstanceOf(DataIntegrityViolationException.class);
    }

    private GraphNodeEntity newNode(UUID owner, String title) {
        GraphNodeEntity n = new GraphNodeEntity();
        n.setCreatedBy(owner);
        n.setKind(GraphNodeEntity.KIND_PATTERN);
        n.setTitle(title);
        return n;
    }

    private GraphEdgeEntity newEdge(UUID owner, UUID fromId, UUID toId) {
        GraphEdgeEntity e = new GraphEdgeEntity();
        e.setCreatedBy(owner);
        e.setFromNodeId(fromId);
        e.setToNodeId(toId);
        e.setKind(GraphEdgeEntity.KIND_TRIGGERS);
        return e;
    }
}
