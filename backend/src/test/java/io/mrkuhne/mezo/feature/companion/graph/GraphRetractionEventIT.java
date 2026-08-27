package io.mrkuhne.mezo.feature.companion.graph;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * The mirror of {@link GraphPromotionEventIT} (bd mezo-b3pp.31, spec §6.2): the two retraction
 * events — {@code PatternRetractedEvent} and {@code GoalDeletedEvent} — each archive the SAME node
 * an earlier promotion created, via the same AFTER_COMMIT -> async {@code GraphPromotionListener}
 * pipeline. NOT {@code @Transactional}, same reason as {@code GraphPromotionEventIT}: the server's
 * own commit has to really happen for AFTER_COMMIT to fire, and Awaitility rides out the async hop.
 */
@ActiveProfiles("companion-fake")
class GraphRetractionEventIT extends ApiIntegrationTest {

    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private GoalPopulator goalPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private void decide(UUID patternId, String decision) {
        postForBody("/api/companion/pattern/" + patternId + "/decision",
            PatternDecisionRequest.builder().decision(decision).build(),
            ownerAuthHeaders(), HttpStatus.OK, Object.class);
    }

    @Test
    void testPatternDecide_shouldArchiveTheNode_whenAConfirmedPatternIsRejected() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_food", "Késői evés rontja az alvást.");

        decide(pattern.getId(), "confirm");
        UUID nodeId = awaitSingleActiveNode(owner).getId();

        decide(pattern.getId(), "reject");

        await().atMost(10, SECONDS).untilAsserted(() -> {
            GraphNodeEntity node = nodeRepository.findById(nodeId).orElseThrow();
            assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        });
    }

    @Test
    void testPatternDecide_shouldArchiveTheNode_whenAConfirmedPatternDropsToMonitoring() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_food", "Késői evés rontja az alvást.");

        decide(pattern.getId(), "confirm");
        UUID nodeId = awaitSingleActiveNode(owner).getId();

        decide(pattern.getId(), "monitor");

        await().atMost(10, SECONDS).untilAsserted(() -> {
            GraphNodeEntity node = nodeRepository.findById(nodeId).orElseThrow();
            assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        });
    }

    @Test
    void testPatternDecide_shouldReviveTheNode_whenARejectedPatternIsConfirmedAgain() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_food", "Késői evés rontja az alvást.");

        decide(pattern.getId(), "confirm");
        UUID nodeId = awaitSingleActiveNode(owner).getId();

        decide(pattern.getId(), "reject");
        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED));

        decide(pattern.getId(), "confirm");

        await().atMost(10, SECONDS).untilAsserted(() -> {
            GraphNodeEntity node = nodeRepository.findById(nodeId).orElseThrow();
            assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        });
        // The anchor held — no duplicate was created for this pattern.
        assertThat(nodeRepository.findAll().stream()
            .filter(n -> pattern.getId().equals(n.getSourceId()))).hasSize(1);
    }

    @Test
    void testPatternDecide_shouldNotCreateANode_whenAPatternIsRejectedWithoutEverBeingConfirmed() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_food", "Késői evés rontja az alvást.");

        decide(pattern.getId(), "reject");

        // "Nothing happened" idiom (GraphPromotionEventIT): a constant-condition check held for a
        // window, not a bare sleep — during() re-asserts the predicate for its whole duration.
        await().during(2, SECONDS).atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findAll().stream()
                .filter(n -> pattern.getId().equals(n.getSourceId()))).isEmpty());
    }

    @Test
    void testGoalDelete_shouldArchiveTheNode_whenAnActiveGoalIsDeleted() {
        UUID owner = ownerId();
        GoalEntity goal = goalPopulator.createGoal(owner, "planned");

        postForBody("/api/goals/" + goal.getId() + "/activate", null,
            ownerAuthHeaders(), HttpStatus.OK, Object.class);
        UUID nodeId = awaitSingleActiveNode(owner).getId();

        deleteAndExpect("/api/goals/" + goal.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            GraphNodeEntity node = nodeRepository.findById(nodeId).orElseThrow();
            assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
        });
    }

    private GraphNodeEntity awaitSingleActiveNode(UUID owner) {
        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE)).hasSize(1));
        return nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            owner, GraphNodeEntity.STATUS_ACTIVE).getFirst();
    }
}
