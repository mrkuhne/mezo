package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphTraversalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-b3pp.34: {@code graph.max-seeds} truncates a large matching set. A separate class from
 * {@link GraphSeedSelectionIT} because the cap is overridden via {@link TestPropertySource} at
 * class scope — the sibling IT's own cases rely on the default (uncapped-for-their-fixture-size)
 * value, the same split {@link GraphPromptAssemblerRefsCapIT} uses for {@code graph.max-refs}.
 */
@TestPropertySource(properties = "mezo.companion.graph.max-seeds=2")
class GraphSeedSelectionCapIT extends AbstractIntegrationTest {

    @Autowired private GraphTraversalService traversalService;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSeedsFor_shouldCapTheSeeds_whenManyNodesMatch() {
        UUID userId = databasePopulator.populateUser("graph-seed-cap@test.local");
        for (int i = 0; i < 5; i++) {
            graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Alvás " + i);
        }

        List<UUID> seeds = traversalService.seedsFor(userId, "alvás");

        assertThat(seeds).hasSize(2);
    }
}
