package io.mrkuhne.mezo.feature.companion.graph;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphPromptAssembler;
import io.mrkuhne.mezo.feature.companion.graph.service.GraphTraversalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** W2.4 (mezo-b3pp.9): deterministic seed selection + the [Összefüggések] block + GraphNode refs. */
class GraphPromptAssemblerIT extends AbstractIntegrationTest {

    @Autowired private GraphPromptAssembler assembler;
    @Autowired private GraphTraversalService traversalService;
    @Autowired private GraphPopulator graphPopulator;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testSeedsFor_shouldMatchFoldedTokensAgainstTitleAndSummary_activeOnly() {
        UUID userId = databasePopulator.populateUser("graph-seeds@test.local");
        GraphNodeEntity byTitle = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity bySummary = graphPopulator.createNode(userId, GraphNodeEntity.KIND_GOAL, "Erőnövelés");
        bySummary.setSummary("Az alvás minősége dönti el a rákövetkező edzést.");
        nodeRepository.saveAndFlush(bySummary);
        GraphNodeEntity archived = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Alvás régen");
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(archived);
        graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");

        List<UUID> seeds = traversalService.seedsFor(userId, "Hogy ALUDTAM? az alvas ma rossz volt");

        // "alvas" (folded) hits the title and the summary; "aludtam" hits nothing; archived is out
        assertThat(seeds).containsExactlyInAnyOrder(byTitle.getId(), bySummary.getId());
        assertThat(traversalService.seedsFor(userId, "")).isEmpty();
        assertThat(traversalService.seedsFor(userId, "ab")).isEmpty();
        // W2.4 review fix: ToolText.searchTokens splits on whitespace/comma/semicolon only, so
        // sentence punctuation used to ride along ("alvás?" → "alvas?") and match nothing
        assertThat(traversalService.seedsFor(userId, "alvás?"))
                .containsExactlyInAnyOrder(byTitle.getId(), bySummary.getId());
        assertThat(traversalService.seedsFor(userId, "(rossz alvás!)"))
                .containsExactlyInAnyOrder(byTitle.getId(), bySummary.getId());
    }

    @Test
    void testAssemble_shouldRenderNeighborhoodAndRefs_whenSeedsMatch() {
        UUID userId = databasePopulator.populateUser("graph-assemble@test.local");
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity c = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Gyenge edzés");
        GraphNodeEntity d = graphPopulator.createNode(userId, GraphNodeEntity.KIND_GOAL, "Erőnövelés");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");
        graphPopulator.createEdge(userId, b.getId(), c.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.600");
        graphPopulator.createEdge(userId, c.getId(), d.getId(), GraphEdgeEntity.KIND_CONFLICTS, "0.900");

        GraphPromptAssembler.GraphContext ctx = assembler.assemble(userId, "miért rossz az alvás mostanában?");

        assertThat(ctx.block()).startsWith(GraphPromptAssembler.CONNECTIONS_HEADER);
        assertThat(ctx.block()).contains("- Késői evés → kiváltja → Rossz alvás · erős\n");
        assertThat(ctx.block()).contains("- Rossz alvás → kiváltja → Gyenge edzés · közepes\n");
        // c→d is 2 hops from b — inside maxHops=2 — but a→b weight 0.8 ranks first; c→d (0.9) ranks above all
        assertThat(ctx.block().indexOf("Gyenge edzés → ütközik vele → Erőnövelés"))
                .isLessThan(ctx.block().indexOf("Késői evés → kiváltja"));
        // one GraphNode ref per rendered node, no duplicates, in first-appearance order
        assertThat(ctx.refs()).extracting(RefsEnvelope.Ref::kind).containsOnly(GraphPromptAssembler.REF_KIND);
        assertThat(ctx.refs()).extracting(RefsEnvelope.Ref::id)
                .containsExactlyInAnyOrder(a.getId().toString(), b.getId().toString(),
                        c.getId().toString(), d.getId().toString());
    }

    /** mezo-b3pp.33: the ref's label is the node's title, taken straight off {@code NeighborEdge}'s
     *  {@code fromTitle}/{@code toTitle} — no separate lookup. */
    @Test
    void testAssemble_shouldLabelEachGraphRefWithItsNodeTitle_whenEdgesRender() {
        UUID userId = databasePopulator.populateUser("graph-labels@test.local");
        GraphNodeEntity a = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Késői evés");
        GraphNodeEntity b = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Rossz alvás");
        GraphNodeEntity c = graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Gyenge edzés");
        graphPopulator.createEdge(userId, a.getId(), b.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.800");
        graphPopulator.createEdge(userId, b.getId(), c.getId(), GraphEdgeEntity.KIND_TRIGGERS, "0.600");

        GraphPromptAssembler.GraphContext ctx = assembler.assemble(userId, "miért rossz az alvás mostanában?");

        assertThat(ctx.refs()).hasSize(3);
        assertThat(ctx.refs()).allSatisfy(ref -> assertThat(ref.kind()).isEqualTo(GraphPromptAssembler.REF_KIND));
        assertThat(ctx.refs()).filteredOn(ref -> ref.id().equals(a.getId().toString()))
                .singleElement().extracting(RefsEnvelope.Ref::label).isEqualTo("Késői evés");
        assertThat(ctx.refs()).filteredOn(ref -> ref.id().equals(b.getId().toString()))
                .singleElement().extracting(RefsEnvelope.Ref::label).isEqualTo("Rossz alvás");
        assertThat(ctx.refs()).filteredOn(ref -> ref.id().equals(c.getId().toString()))
                .singleElement().extracting(RefsEnvelope.Ref::label).isEqualTo("Gyenge edzés");
    }

    @Test
    void testAssemble_shouldBeEmpty_whenNoSeedOrNoEdges() {
        UUID userId = databasePopulator.populateUser("graph-assemble-empty@test.local");
        graphPopulator.createNode(userId, GraphNodeEntity.KIND_PATTERN, "Magányos csúcs alvás");

        assertThat(assembler.assemble(userId, "semmi köze")).isSameAs(GraphPromptAssembler.GraphContext.EMPTY);
        // a seed with no edges renders nothing either — a lone node is not a connection
        assertThat(assembler.assemble(userId, "alvás")).isSameAs(GraphPromptAssembler.GraphContext.EMPTY);
    }
}
