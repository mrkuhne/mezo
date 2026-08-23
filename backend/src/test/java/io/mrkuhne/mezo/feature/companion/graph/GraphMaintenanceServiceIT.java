package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphMaintenanceResult;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphMaintenanceService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W2.5 (bd mezo-b3pp.10, spec §6.5): the nightly maintenance pass's pure arithmetic —
 *  decay, floor-prune, stale-candidate-prune, fresh-pattern reinforcement. No LLM involved. */
class GraphMaintenanceServiceIT extends AbstractIntegrationTest {

    @Autowired private GraphMaintenanceService maintenanceService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testRunMaintenance_shouldDecayEveryActiveEdge_byTheConfiguredFactor() {
        UUID owner = ownerId();
        GraphNodeEntity a = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "A");
        GraphNodeEntity b = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "B");
        graphPopulator.createEdge(owner, a.getId(), b.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.800");

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesDecayed()).isEqualTo(1);
        List<GraphEdgeEntity> edges = edgeRepository.findByCreatedByAndDeletedFalse(owner);
        assertThat(edges).hasSize(1);
        // default decayFactor = 0.99 -> 0.800 * 0.99 = 0.792
        assertThat(edges.get(0).getWeight()).isEqualByComparingTo(new BigDecimal("0.792"));
    }

    @Test
    void testRunMaintenance_shouldPruneEdges_thatDecayBelowTheFloor() {
        UUID owner = ownerId();
        GraphNodeEntity a = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "A");
        GraphNodeEntity b = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "B");
        // default pruneFloor = 0.05; 0.020 * 0.99 = 0.0198 -> rounds to 0.020, well under 0.05 ->
        // pruned. (NOT 0.050: 0.050 * 0.99 = 0.0495, which rounds HALF_UP right back to 0.050 —
        // exactly AT the floor, not under it, and would NOT prune.)
        graphPopulator.createEdge(owner, a.getId(), b.getId(), GraphEdgeEntity.KIND_RELATES_TO, "0.020");

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesPruned()).isEqualTo(1);
        assertThat(edgeRepository.findByCreatedByAndDeletedFalse(owner)).isEmpty();
    }

    @Test
    void testRunMaintenance_shouldPruneStaleCandidates_butNeverActiveNodes() {
        UUID owner = ownerId();
        Instant old = Instant.now().minus(31, ChronoUnit.DAYS);
        GraphNodeEntity staleCandidate = graphPopulator.createCandidateNodeAt(
            owner, GraphNodeEntity.KIND_LIFE_EVENT, "Régi jelölt", null, Map.of(), old);
        GraphNodeEntity freshCandidate = graphPopulator.createCandidateNode(
            owner, GraphNodeEntity.KIND_LIFE_EVENT, "Friss jelölt", null, Map.of());
        GraphNodeEntity activeOldNode = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Aktív");

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.candidatesPruned()).isEqualTo(1);
        assertThat(nodeRepository.findByIdAndCreatedByAndDeletedFalse(staleCandidate.getId(), owner)).isEmpty();
        assertThat(nodeRepository.findByIdAndCreatedByAndDeletedFalse(freshCandidate.getId(), owner)).isPresent();
        assertThat(nodeRepository.findByIdAndCreatedByAndDeletedFalse(activeOldNode.getId(), owner)).isPresent();
    }

    @Test
    void testRunMaintenance_shouldReinforceEdges_ofAPromotedPatternWithAFreshSnapshot() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_mood", "Alvás -> hangulat");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
        GraphNodeEntity patternNode = graphPopulator.createNode(
            owner, GraphNodeEntity.KIND_PATTERN, "Alvás -> hangulat");
        // simulate GraphPromotionService.upsertNode's source anchor without invoking the LLM structurer
        setSource(patternNode, GraphPromotionService.SOURCE_PATTERN, pattern.getId());
        GraphNodeEntity other = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Kapcsolódó");
        graphPopulator.createEdge(owner, patternNode.getId(), other.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.600");
        patternEventPopulator.snapshot(owner, pattern.getId(), -0.55, 15, 0.03, Instant.now().minus(2, ChronoUnit.HOURS));

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesReinforced()).isEqualTo(1);
        GraphEdgeEntity edge = edgeRepository.findByCreatedByAndDeletedFalse(owner).get(0);
        // decayed first (0.600 * 0.99 = 0.594), then reinforced (+0.05 = 0.644)
        assertThat(edge.getWeight()).isEqualByComparingTo(new BigDecimal("0.644"));
        assertThat(edge.getLastReinforcedAt()).isNotNull();
    }

    @Test
    void testRunMaintenance_shouldNotReinforce_whenTheSnapshotIsStale() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_focus", "Alvás -> fókusz");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(pattern);
        GraphNodeEntity patternNode = graphPopulator.createNode(
            owner, GraphNodeEntity.KIND_PATTERN, "Alvás -> fókusz");
        setSource(patternNode, GraphPromotionService.SOURCE_PATTERN, pattern.getId());
        GraphNodeEntity other = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Kapcsolódó");
        graphPopulator.createEdge(owner, patternNode.getId(), other.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.600");
        // 3 days old -> outside the 1-day freshness window
        patternEventPopulator.snapshot(owner, pattern.getId(), -0.4, 10, 0.05, Instant.now().minus(3, ChronoUnit.DAYS));

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        assertThat(result.edgesReinforced()).isZero();
    }

    @Test
    void testRunMaintenance_shouldReinforceASharedEdge_onlyOnce_whenBothEndpointsAreFreshPatterns() {
        UUID owner = ownerId();
        PatternEntity patternA = patternPopulator.createPattern(owner, "sleep_vs_energy", "Alvás -> energia");
        patternA.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(patternA);
        PatternEntity patternB = patternPopulator.createPattern(owner, "energy_vs_mood", "Energia -> hangulat");
        patternB.setStatus(PatternEntity.STATUS_CONFIRMED);
        patternPopulator.save(patternB);
        GraphNodeEntity nodeA = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Alvás -> energia");
        setSource(nodeA, GraphPromotionService.SOURCE_PATTERN, patternA.getId());
        GraphNodeEntity nodeB = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Energia -> hangulat");
        setSource(nodeB, GraphPromotionService.SOURCE_PATTERN, patternB.getId());
        // one edge directly between the two pattern nodes -- surfaces from A's from-query AND B's to-query
        graphPopulator.createEdge(owner, nodeA.getId(), nodeB.getId(), GraphEdgeEntity.KIND_SUPPORTS, "0.600");
        // both patterns get a fresh snapshot this run
        patternEventPopulator.snapshot(owner, patternA.getId(), -0.55, 15, 0.03, Instant.now().minus(1, ChronoUnit.HOURS));
        patternEventPopulator.snapshot(owner, patternB.getId(), 0.50, 12, 0.04, Instant.now().minus(2, ChronoUnit.HOURS));

        GraphMaintenanceResult result = maintenanceService.runMaintenance(owner);

        // must be bumped ONCE, not twice: decayed first (0.600 * 0.99 = 0.594), then +0.05 = 0.644
        assertThat(result.edgesReinforced()).isEqualTo(1);
        List<GraphEdgeEntity> edges = edgeRepository.findByCreatedByAndDeletedFalse(owner);
        assertThat(edges).hasSize(1);
        assertThat(edges.get(0).getWeight()).isEqualByComparingTo(new BigDecimal("0.644"));
    }

    /** Test-only: sets the source anchor directly via the repository (bypasses the LLM edge
     *  structurer that {@code GraphPromotionService.promotePattern} would trigger for a new node —
     *  reinforcement only needs the anchor, not real structured edges). */
    private void setSource(GraphNodeEntity node, String sourceKind, UUID sourceId) {
        node.setSourceKind(sourceKind);
        node.setSourceId(sourceId);
        nodeRepository.saveAndFlush(node);
    }
}
