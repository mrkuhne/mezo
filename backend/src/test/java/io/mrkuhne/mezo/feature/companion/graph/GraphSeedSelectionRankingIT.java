package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
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
 * mezo-b3pp.34: with {@code graph.max-seeds=1} (so the cap actually bites with only two
 * candidates), proves the rank ORDER used before truncation — a TITLE hit outranks a
 * summary-only hit, then more distinct matching tokens wins. Separate class from
 * {@link GraphSeedSelectionIT}/{@link GraphSeedSelectionCapIT} for the same
 * {@link TestPropertySource}-at-class-scope reason as {@link GraphPromptAssemblerRefsCapIT}.
 */
@TestPropertySource(properties = "mezo.companion.graph.max-seeds=1")
class GraphSeedSelectionRankingIT extends AbstractIntegrationTest {

    @Autowired private GraphTraversalService traversalService;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSeedsFor_shouldPreferTitleMatches_whenTheCapBites() {
        UUID userId = databasePopulator.populateUser("graph-seed-title-pref@test.local");
        GraphNodeEntity byTitle = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity bySummary = graphPopulator.createNode(userId, GraphNodeEntity.KIND_GOAL, "Erőnövelés");
        bySummary.setSummary("Az alvás minősége dönti el a rákövetkező edzést.");
        nodeRepository.saveAndFlush(bySummary);

        List<UUID> seeds = traversalService.seedsFor(userId, "alvás");

        assertThat(seeds).containsExactly(byTitle.getId());
    }

    @Test
    void testSeedsFor_shouldPreferMoreDistinctTokenMatches_whenTitlesTie() {
        UUID userId = databasePopulator.populateUser("graph-seed-token-pref@test.local");
        GraphNodeEntity twoTokens = graphPopulator.createNode(
                userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás és gyenge edzés");
        graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");

        List<UUID> seeds = traversalService.seedsFor(userId, "rossz alvás edzés");

        assertThat(seeds).containsExactly(twoTokens.getId());
    }
}
