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

/**
 * mezo-b3pp.34: {@link GraphTraversalService#seedsFor} defects — a stopword filter and word-START
 * (not plain-substring) matching, on the default {@code graph.max-seeds}. The rank-then-cap cases
 * live in {@link GraphSeedSelectionCapIT} and {@link GraphSeedSelectionRankingIT}, which override
 * {@code graph.max-seeds} per-class the way {@link GraphPromptAssemblerRefsCapIT} overrides
 * {@code graph.max-refs}.
 */
class GraphSeedSelectionIT extends AbstractIntegrationTest {

    @Autowired private GraphTraversalService traversalService;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSeedsFor_shouldIgnoreStopwords_whenTheMessageIsMostlyFiller() {
        UUID userId = databasePopulator.populateUser("graph-seed-stopwords@test.local");
        graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");

        // every token is a stopword or <3 chars — this is the defect: today each of "nem"/"hogy"/
        // "csak"/"meg"/"volt"/"kell" matches any summary containing it, seeding most of the graph
        List<UUID> seeds = traversalService.seedsFor(userId, "nem hiszem hogy csak most kell meg volt");

        assertThat(seeds).isEmpty();
    }

    @Test
    void testSeedsFor_shouldStillSeed_whenAStopwordSentenceAlsoCarriesARealWord() {
        UUID userId = databasePopulator.populateUser("graph-seed-stopword-plus-real@test.local");
        GraphNodeEntity node = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");

        // guards against a stopword list so eager it kills real turns: the stopwords are dropped,
        // but "eves" (from "evés") still matches the node title
        List<UUID> seeds = traversalService.seedsFor(userId, "nem hiszem hogy az evés a baj");

        assertThat(seeds).containsExactly(node.getId());
    }

    @Test
    void testSeedsFor_shouldMatchAtAWordStart_whenTheTokenIsAPrefixOfALongerWord() {
        UUID userId = databasePopulator.populateUser("graph-seed-word-start@test.local");
        GraphNodeEntity node = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Alvásminőség");

        // folded "alvas" starts the folded word "alvasminoseg" — agglutinative Hungarian needs
        // this, not exact-word matching
        List<UUID> seeds = traversalService.seedsFor(userId, "alvás");

        assertThat(seeds).containsExactly(node.getId());
    }

    @Test
    void testSeedsFor_shouldNotMatchMidWord_whenTheTokenIsOnlyAnInfix() {
        UUID userId = databasePopulator.populateUser("graph-seed-no-infix@test.local");
        graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Vitalitás");

        // the bd's own example: "ital" must not match "vitalitás" — plain substring containment
        // is exactly the bug being fixed here
        List<UUID> seeds = traversalService.seedsFor(userId, "ital");

        assertThat(seeds).isEmpty();
    }

    @Test
    void testSeedsFor_shouldBeDeterministic_whenRunTwiceOnTheSameData() {
        UUID userId = databasePopulator.populateUser("graph-seed-deterministic@test.local");
        for (int i = 0; i < 5; i++) {
            graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Alvás " + i);
        }

        List<UUID> first = traversalService.seedsFor(userId, "alvás");
        List<UUID> second = traversalService.seedsFor(userId, "alvás");

        assertThat(first).isEqualTo(second);
    }

    @Test
    void testSeedsFor_shouldReturnEmpty_whenTheMessageHasNoUsableTokens() {
        UUID userId = databasePopulator.populateUser("graph-seed-no-tokens@test.local");
        graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");

        // IDENT-3: empty seeds must never throw — "ma"/"az" are both <3 chars
        List<UUID> seeds = traversalService.seedsFor(userId, "ma az");

        assertThat(seeds).isEmpty();
    }
}
