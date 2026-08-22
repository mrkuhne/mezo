package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W2.2 (bd mezo-b3pp.7, spec §6.2): the deterministic half of promotion — pattern/fact/goal rows
 * become graph nodes exactly once, keyed by (createdBy, sourceKind, sourceId). {@code
 * companion-fake} is needed from this slice on: the W2.2 edge structurer calls {@code
 * CompanionLlm} for a newly promoted PATTERN node, and ITs must never touch the network.
 */
@ActiveProfiles("companion-fake")
class GraphPromotionServiceIT extends AbstractIntegrationTest {

    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private GraphEdgeRepository edgeRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private GoalRepository goalRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GraphPopulator graphPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private PatternEntity confirmedPattern(UUID owner) {
        PatternEntity p = patternPopulator.createPattern(owner, "sleep_vs_soreness", "Késői evés rontja az alvást.");
        p.setStatus(PatternEntity.STATUS_CONFIRMED);
        p.setR(new BigDecimal("-0.610"));
        p.setN(21);
        return patternPopulator.save(p);
    }

    @Test
    void testPromotePattern_shouldCreateExactlyOneNode_whenCalledTwice() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);

        GraphNodeEntity first = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();
        GraphNodeEntity second = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(nodeRepository.findAll()).hasSize(1);
        assertThat(first.getKind()).isEqualTo(GraphNodeEntity.KIND_PATTERN);
        assertThat(first.getTitle()).isEqualTo("Késői evés rontja az alvást.");
        assertThat(first.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(first.getSourceKind()).isEqualTo("pattern");
        assertThat(first.getSourceId()).isEqualTo(pattern.getId());
        assertThat(first.getMeta()).containsEntry("n", 21).containsEntry("direction", "negative");
        // pattern.r is numeric(6,4) — the DB round-trip normalizes -0.610 to -0.6100.
        assertThat(String.valueOf(first.getMeta().get("r"))).isEqualTo("-0.6100");
    }

    @Test
    void testPromotePattern_shouldTruncateTitle_whenPatternTitleExceeds120Chars() {
        UUID owner = ownerId();
        String longTitle = "Nagyon hosszú mintacím, amely messze túllépi a knowledge_node title mezőjének korlátját, "
            + "hiszen jóval több, mint száztizenhúsz karakterből áll, hogy a levágás logikáját tesztelje.";
        assertThat(longTitle.length()).isGreaterThan(120);
        PatternEntity pattern = patternPopulator.createPattern(owner, "long_title_pair", longTitle);
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        pattern = patternPopulator.save(pattern);

        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        assertThat(node.getTitle()).hasSizeLessThanOrEqualTo(120);
    }

    @Test
    void testPromotePattern_shouldReturnEmpty_whenPatternIsNotConfirmed() {
        UUID owner = ownerId();
        PatternEntity proposed = patternPopulator.createPattern(owner, "weight_vs_mood", "Súlyingadozás rontja a hangulatot.");

        assertThat(promotionService.promotePattern(owner, proposed.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testPromoteFact_shouldCreatePreferenceNode_whenSourceIsChat() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText("Reggel jobban bírom az erős edzést.");
        fact.setCategory("train");
        fact.setSource(KnowledgeFactEntity.SOURCE_CHAT);
        fact = knowledgeFactRepository.saveAndFlush(fact);

        GraphNodeEntity node = promotionService.promoteFact(owner, fact.getId()).orElseThrow();

        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_PREFERENCE);
        assertThat(node.getTitle()).isEqualTo("Reggel jobban bírom az erős edzést.");
        assertThat(node.getSourceKind()).isEqualTo("knowledge_fact");
        assertThat(node.getMeta()).containsEntry("category", "train");
    }

    @Test
    void testPromoteFact_shouldSkip_whenFactCameFromAPattern() {
        UUID owner = ownerId();
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText("Késői evés rontja az alvást.");
        fact.setCategory("health");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        fact = knowledgeFactRepository.saveAndFlush(fact);

        assertThat(promotionService.promoteFact(owner, fact.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testSyncGoal_shouldUpsertActiveNode_thenArchiveIt_whenGoalLeavesActive() {
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoal(owner, "active");

        GraphNodeEntity node = promotionService.syncGoal(owner, goal.getId()).orElseThrow();
        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        goal.setStatus("archived");
        goalRepository.saveAndFlush(goal);
        GraphNodeEntity archived = promotionService.syncGoal(owner, goal.getId()).orElseThrow();

        assertThat(archived.getId()).isEqualTo(node.getId());
        assertThat(archived.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        assertThat(nodeRepository.findAll()).hasSize(1);
    }

    @Test
    void testSyncGoal_shouldReturnEmpty_whenGoalNeverActiveAndNotYetPromoted() {
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoal(owner, "planned");

        assertThat(promotionService.syncGoal(owner, goal.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    @Test
    void testPromotePattern_shouldReturnEmpty_whenPatternBelongsToAnotherUser() {
        UUID owner = ownerId();
        UUID stranger = databasePopulator.populateUser("stranger-" + UUID.randomUUID() + "@example.com");
        PatternEntity pattern = confirmedPattern(owner);

        assertThat(promotionService.promotePattern(stranger, pattern.getId())).isEmpty();
        assertThat(nodeRepository.findAll()).isEmpty();
    }

    /** The fake echoes a [fake-graph-edges:{json}] sentinel planted in the pattern MECHANISM (it
     *  becomes the node's unbounded summary — unlike the title, which knowledge_node truncates to
     *  120 chars and would clip the sentinel's closing bracket). */
    @Test
    void testPromotePattern_shouldCreateOnlyFloorPassingEdges_whenStructurerSuggests() {
        UUID owner = ownerId();
        GraphNodeEntity existingA = graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Alvásminőség");
        GraphNodeEntity existingB = graphPopulator.createNode(owner, GraphNodeEntity.KIND_GOAL, "Fogyás 8 kg");
        PatternEntity pattern = confirmedPattern(owner);
        // index 0/1 follow the structurer's own listing order (active nodes, newest first)
        pattern.setMechanism("Késői evés rontja az alvást. "
            + "[fake-graph-edges:[{\"index\":0,\"kind\":\"TRIGGERS\",\"confidence\":0.8},"
            + "{\"index\":1,\"kind\":\"RELATES_TO\",\"confidence\":0.2}]]");
        pattern = patternPopulator.save(pattern);

        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        var edges = edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(owner, node.getId());
        assertThat(edges).hasSize(1);
        assertThat(edges.getFirst().getKind()).isEqualTo(GraphEdgeEntity.KIND_TRIGGERS);
        assertThat(edges.getFirst().getWeight()).isEqualByComparingTo(new BigDecimal("0.400")); // 0.8 × 0.5
        assertThat(edges.getFirst().getEvidence()).hasSize(1);
        assertThat(edges.getFirst().getEvidence().getFirst().sourceKind()).isEqualTo("pattern");
        // the below-floor (0.2) suggestion toward existingB never became an edge
        assertThat(edges.getFirst().getToNodeId()).isIn(existingA.getId(), existingB.getId());
    }

    @Test
    void testPromotePattern_shouldNotCallStructurerAgain_whenReconfirmed() {
        UUID owner = ownerId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Alvásminőség");
        PatternEntity pattern = confirmedPattern(owner);
        pattern.setMechanism("Késői evés rontja az alvást. "
            + "[fake-graph-edges:[{\"index\":0,\"kind\":\"TRIGGERS\",\"confidence\":0.9}]]");
        pattern = patternPopulator.save(pattern);

        GraphNodeEntity first = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();
        var afterFirst = edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(owner, first.getId());
        // re-promotion is a pure UPSERT — no second structurer run, no extra edges
        promotionService.promotePattern(owner, pattern.getId());

        assertThat(edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(owner, first.getId()))
            .hasSameSizeAs(afterFirst);
        assertThat(afterFirst).hasSize(1);
    }

    @Test
    void testPromotePattern_shouldCreateNoEdges_whenNoOtherNodeExists() {
        UUID owner = ownerId();
        PatternEntity pattern = confirmedPattern(owner);

        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        assertThat(edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(owner, node.getId())).isEmpty();
    }

    @Test
    void testPromotePattern_shouldStillCreateTheNode_whenStructurerAnswerIsUnparseable() {
        UUID owner = ownerId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PREFERENCE, "Alvásminőség");
        PatternEntity pattern = confirmedPattern(owner);   // no sentinel -> the fake echoes the prompt

        GraphNodeEntity node = promotionService.promotePattern(owner, pattern.getId()).orElseThrow();

        assertThat(node.getId()).isNotNull();
        assertThat(edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(owner, node.getId())).isEmpty();
    }
}
