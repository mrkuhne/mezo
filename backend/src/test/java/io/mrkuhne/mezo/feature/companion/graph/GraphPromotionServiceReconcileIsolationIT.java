package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromotionService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;

/**
 * W2.5 prerequisite (bd mezo-b3pp.32, flagged during W2.2's final review): {@code reconcile}
 * must not abort the whole sweep on the first failing row, since W2.5's {@code GraphMaintenanceJob}
 * calls it nightly across every user. Own IT class — the {@code @MockitoSpyBean} forks the
 * application context, the {@code ChatServiceGraphBlockFailureIT} precedent for why that fork
 * must not leak into {@code GraphPromotionServiceIT}'s other (non-spy) tests.
 */
class GraphPromotionServiceReconcileIsolationIT extends AbstractIntegrationTest {

    @MockitoSpyBean private GraphPromotionService promotionService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private GoalPopulator goalPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testReconcile_shouldIsolatePerRowFailures_soOneBadPatternDoesNotSkipFactsAndGoals() {
        UUID owner = ownerId();
        PatternEntity pattern = patternPopulator.createPattern(owner, "isolation_case", "Hibás minta.");
        pattern.setStatus(PatternEntity.STATUS_CONFIRMED);
        pattern.setR(new BigDecimal("-0.500"));
        pattern.setN(10);
        patternPopulator.save(pattern);
        doThrow(new RuntimeException("boom")).when(promotionService).promotePattern(owner, pattern.getId());
        KnowledgeFactEntity manual = new KnowledgeFactEntity();
        manual.setCreatedBy(owner);
        manual.setFactText("Kézzel rögzített preferencia — a hibás minta után is le kell futnia.");
        manual.setCategory("life");
        manual.setSource(KnowledgeFactEntity.SOURCE_MANUAL);
        knowledgeFactRepository.saveAndFlush(manual);
        goalPopulator.createGoal(owner, "active");

        int count = promotionService.reconcile(owner);

        // the failing pattern contributes 0; the fact + the active goal still promote
        assertThat(count).isEqualTo(2);
        assertThat(nodeRepository.findAll())
            .extracting(GraphNodeEntity::getKind)
            .containsExactlyInAnyOrder(GraphNodeEntity.KIND_PREFERENCE, GraphNodeEntity.KIND_GOAL);
    }
}
