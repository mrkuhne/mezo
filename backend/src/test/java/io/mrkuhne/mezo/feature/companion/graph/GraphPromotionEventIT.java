package io.mrkuhne.mezo.feature.companion.graph;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * W2.2 acceptance (bd mezo-b3pp.7, spec §6.2): the three write-path surfaces each end with exactly
 * ONE live graph node — via an AFTER_COMMIT event -> the async {@code GraphPromotionListener}.
 * NOT {@code @Transactional} (the {@code JournalEmbeddingEventIT} idiom) so the server's own
 * commit really happens and AFTER_COMMIT genuinely fires; Awaitility rides out the async hop.
 */
@ActiveProfiles("companion-fake")
class GraphPromotionEventIT extends ApiIntegrationTest {

    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private GoalPopulator goalPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testConfirmPattern_shouldPromoteExactlyOneNode_whenDecidedTwice() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "sleep_vs_food", "Késői evés rontja az alvást.");

        postForBody("/api/companion/pattern/" + pattern.getId() + "/decision",
            PatternDecisionRequest.builder().decision("confirm").build(),
            ownerAuthHeaders(), HttpStatus.OK, Object.class);

        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE)).hasSize(1));

        // Re-confirm: the decision transition fires again, but promotion is an idempotent UPSERT —
        // still exactly one node, never a duplicate.
        postForBody("/api/companion/pattern/" + pattern.getId() + "/decision",
            PatternDecisionRequest.builder().decision("confirm").build(),
            ownerAuthHeaders(), HttpStatus.OK, Object.class);

        await().during(2, SECONDS).atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE)).hasSize(1));

        GraphNodeEntity node = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
            owner, GraphNodeEntity.STATUS_ACTIVE).getFirst();
        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_PATTERN);
        assertThat(node.getSourceId()).isEqualTo(pattern.getId());
    }

    @Test
    void testAcceptFactCandidate_shouldPromoteExactlyOnePreferenceNode_whenAccepted() {
        UUID owner = ownerId();
        LearnedFactEntity candidate = learnedFactPopulator.candidate(owner, "Laktózérzékeny vagyok.", null);

        postForBody("/api/companion/fact/candidate/" + candidate.getId() + "/decision",
            FactDecisionRequest.builder().decision("accept").build(),
            ownerAuthHeaders(), HttpStatus.OK, Object.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var nodes = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE);
            assertThat(nodes).hasSize(1);
            assertThat(nodes.getFirst().getKind()).isEqualTo(GraphNodeEntity.KIND_PREFERENCE);
        });
    }

    @Test
    void testActivateGoal_shouldPromoteOneActiveGoalNodeAndArchivePrevious_whenActivated() {
        UUID owner = ownerId();
        GoalEntity previouslyActive = goalPopulator.createGoal(owner, "planned");
        GoalEntity toActivate = goalPopulator.createGoal(owner, "planned");

        // Activate the first goal through the API so it gets a genuine GOAL node (syncGoal only
        // shadows a demoted goal that was already promoted — "never promoted, never active" is a
        // no-op, see GraphPromotionService.syncGoal), THEN activate the second — the single-active
        // invariant demotes the first, which must now archive the node created above.
        postForBody("/api/goals/" + previouslyActive.getId() + "/activate", null,
            ownerAuthHeaders(), HttpStatus.OK, Object.class);
        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE)).hasSize(1));

        postForBody("/api/goals/" + toActivate.getId() + "/activate", null,
            ownerAuthHeaders(), HttpStatus.OK, Object.class);

        await().atMost(10, SECONDS).untilAsserted(() -> {
            var activeNodes = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE);
            assertThat(activeNodes).hasSize(1);
            assertThat(activeNodes.getFirst().getKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
            assertThat(activeNodes.getFirst().getSourceId()).isEqualTo(toActivate.getId());

            var archivedNodes = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ARCHIVED);
            assertThat(archivedNodes).hasSize(1);
            assertThat(archivedNodes.getFirst().getKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
            assertThat(archivedNodes.getFirst().getSourceId()).isEqualTo(previouslyActive.getId());
        });
    }
}
