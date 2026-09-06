package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * mezo-iizd.11: active life goal -> GOAL node, sourced through the {@code LifeGoalGraphSource}
 * port (companion cannot import lifegoal — ArchUnit cycle rule). The {@code GraphPromotionServiceIT}
 * shape, restricted to the life-goal source.
 */
@ActiveProfiles("companion-fake")
class GraphPromotionLifeGoalIT extends AbstractIntegrationTest {

    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphService graphService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private LifeGoalRepository lifeGoalRepository;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private CompanionProperties companionProperties;

    private UUID userId;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private UUID createLifeGoal(String title, String status) {
        LifeGoalEntity g = lifeGoalPopulator.goal(userId, status);
        g.setTitle(title);
        return lifeGoalRepository.saveAndFlush(g).getId();
    }

    private void setLifeGoalStatus(UUID goalId, String status) {
        LifeGoalEntity g = lifeGoalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElseThrow();
        g.setStatus(status);
        lifeGoalRepository.saveAndFlush(g);
    }

    private void deleteLifeGoal(UUID goalId) {
        LifeGoalEntity g = lifeGoalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId).orElseThrow();
        lifeGoalRepository.delete(g);
        lifeGoalRepository.flush();
    }

    @Test
    void syncLifeGoal_shouldPromoteAnActiveGoal() {
        userId = ownerId();
        UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);

        GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();

        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_GOAL);
        assertThat(node.getSourceKind()).isEqualTo(GraphPromotionService.SOURCE_LIFE_GOAL);
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(node.getTitle()).isEqualTo("Kockahas");
    }

    /** A parkolt cél node-ja archiválódik — a syncGoal mintája. A .11 bd-leírása ezt tévesen
     *  „minden éjjel visszakapcsolna"-ként írta le (spec D8). */
    @Test
    void syncLifeGoal_shouldArchiveTheNode_whenTheGoalIsParked() {
        userId = ownerId();
        UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
        promotionService.syncLifeGoal(userId, goalId);
        setLifeGoalStatus(goalId, "parked");

        assertThat(promotionService.syncLifeGoal(userId, goalId).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void syncLifeGoal_shouldBeANoop_whenAGoalWasNeverActive() {
        userId = ownerId();
        UUID goalId = createLifeGoal("Ötlet", "draft");

        assertThat(promotionService.syncLifeGoal(userId, goalId)).isEmpty();
    }

    @Test
    void syncLifeGoal_shouldReviveTheNode_whenAParkedGoalIsReactivated() {
        userId = ownerId();
        UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
        GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();
        setLifeGoalStatus(goalId, "parked");
        promotionService.syncLifeGoal(userId, goalId);
        setLifeGoalStatus(goalId, LifeGoalEntity.STATUS_ACTIVE);

        promotionService.syncLifeGoal(userId, goalId);

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    /** Az S1 guardja az életcél-node-ra is áll. */
    @Test
    void reconcile_shouldNotResurrect_whenTheUserArchivedALifeGoalNode() {
        userId = ownerId();
        UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
        GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();
        graphService.archive(userId, node.getId());

        promotionService.reconcile(userId);

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }

    @Test
    void reconcile_shouldPromoteEveryActiveLifeGoal() {
        userId = ownerId();
        createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
        createLifeGoal("Side hustle", LifeGoalEntity.STATUS_ACTIVE);

        promotionService.reconcile(userId);

        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                userId, GraphNodeEntity.STATUS_ACTIVE))
            .filteredOn(n -> GraphPromotionService.SOURCE_LIFE_GOAL.equals(n.getSourceKind()))
            .hasSize(2);
    }

    /** A komplementer-söprés ága: egy törölt életcél node-ja nem maradhat aktív. */
    @Test
    void reconcile_shouldArchiveTheNode_whenTheLifeGoalWasDeleted() {
        userId = ownerId();
        UUID goalId = createLifeGoal("Kockahas", LifeGoalEntity.STATUS_ACTIVE);
        GraphNodeEntity node = promotionService.syncLifeGoal(userId, goalId).orElseThrow();
        deleteLifeGoal(goalId);

        promotionService.reconcile(userId);

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ARCHIVED);
    }
}
