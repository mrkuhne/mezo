package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.LifeGoalGraphSource;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Final review Finding 1 (mezo-iizd.11): with the knowledge-graph switch ON but the LIFEGOAL_SWITCH
 * OFF, the {@code LifeGoalGraphSource} bean is absent while {@link GraphPromotionService} still
 * exists. A missing port means "the graph cannot see life goals right now", NOT "the user has no
 * life goals" — {@link GraphPromotionService#retractLifeGoal} must therefore leave every
 * {@code life_goal}-sourced node exactly as it found it (no mass archive) rather than treating the
 * absent bean as "nothing still qualifies". Own IT class — the {@link TestPropertySource} override
 * forks the Spring context, following the {@code ContextSnapshotAssemblerLifeGoalSwitchOffIT} idiom.
 *
 * <p>No mock is used: the {@code life_goal}-sourced node is written directly through
 * {@link GraphService#upsertNode} (bypassing the absent {@link LifeGoalGraphSource} port entirely),
 * exactly the shape a real promoted node would have.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.lifegoal.enabled=false")
class GraphPromotionLifeGoalSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private ApplicationContext context;
    @Autowired private GraphPromotionService promotionService;
    @Autowired private GraphService graphService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testLifeGoalGraphSourceBean_shouldNotExist_whenLifegoalSwitchOff() {
        assertThat(context.getBeanNamesForType(LifeGoalGraphSource.class)).isEmpty();
    }

    @Test
    void retractLifeGoal_shouldLeaveTheNodeActive_whenThePortIsAbsent() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        UUID goalId = UUID.randomUUID();
        GraphNodeEntity node = graphService.upsertNode(owner, GraphNodeEntity.KIND_GOAL, "Kockahas",
            "Kockahas", GraphPromotionService.SOURCE_LIFE_GOAL, goalId, null, Map.of("status", "active"));
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);

        assertThat(promotionService.retractLifeGoal(owner, goalId)).isEmpty();

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void reconcile_shouldNotArchiveLifeGoalNodes_whenThePortIsAbsent() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        UUID goalId = UUID.randomUUID();
        GraphNodeEntity node = graphService.upsertNode(owner, GraphNodeEntity.KIND_GOAL, "Kockahas",
            "Kockahas", GraphPromotionService.SOURCE_LIFE_GOAL, goalId, null, Map.of("status", "active"));

        promotionService.reconcile(owner);

        assertThat(nodeRepository.findById(node.getId()).orElseThrow().getStatus())
            .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }
}
