package io.mrkuhne.mezo.feature.companion.graph.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphTraversalQuery.NeighborEdge;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GraphPromptAssemblerTest {

    private static NeighborEdge edge(String from, String to, String kind, String weight) {
        return new NeighborEdge(UUID.randomUUID(), UUID.randomUUID(), from,
                UUID.randomUUID(), to, kind, new BigDecimal(weight), 1);
    }

    @Test
    void testRenderBlock_shouldRenderHungarianLinesWithStrength() {
        GraphPromptAssembler.Rendered r = GraphPromptAssembler.renderBlock(List.of(
                edge("Késői evés", "Rossz alvás", GraphEdgeEntity.KIND_TRIGGERS, "0.800"),
                edge("Rossz alvás", "Gyenge edzés", GraphEdgeEntity.KIND_SUPPORTS, "0.400"),
                edge("Esti séta", "Rossz alvás", GraphEdgeEntity.KIND_CONFLICTS, "0.100")), 800);

        assertThat(r.block()).startsWith(GraphPromptAssembler.CONNECTIONS_HEADER);
        assertThat(r.block()).contains("- Késői evés → kiváltja → Rossz alvás · erős\n");
        assertThat(r.block()).contains("- Rossz alvás → támogatja → Gyenge edzés · közepes\n");
        assertThat(r.block()).contains("- Esti séta → ütközik vele → Rossz alvás · gyenge\n");
        assertThat(r.rendered()).hasSize(3);
    }

    /** W2.4 review fix: `from PRECEDED_BY to` means the TO-node happened FIRST, so the rendered
     *  line swaps the endpoints — the header promises cause → viszony → okozat for every line. */
    @Test
    void testRenderBlock_shouldSwapEndpointsForPrecededBy_soTheLineReadsCauseFirst() {
        GraphPromptAssembler.Rendered r = GraphPromptAssembler.renderBlock(List.of(
                edge("Stressz", "Költözés", GraphEdgeEntity.KIND_PRECEDED_BY, "0.800")), 800);

        // stored: Stressz PRECEDED_BY Költözés ⇒ Költözés was first ⇒ it leads the line
        assertThat(r.block()).contains("- Költözés → megelőzte → Stressz · erős\n");
        assertThat(r.block()).doesNotContain("- Stressz → megelőzte → Költözés");
    }

    @Test
    void testRenderBlock_shouldStopAtFirstOverflowingEdge_andBeEmptyWhenNothingFits() {
        List<NeighborEdge> edges = List.of(
                edge("A", "B", GraphEdgeEntity.KIND_RELATES_TO, "0.900"),
                edge("C", "D", GraphEdgeEntity.KIND_RELATES_TO, "0.800"));
        int headerTokens = GraphPromptAssembler.estimateTokens(GraphPromptAssembler.CONNECTIONS_HEADER.length());

        GraphPromptAssembler.Rendered one = GraphPromptAssembler.renderBlock(edges, headerTokens + 12);
        assertThat(one.rendered()).hasSize(1);

        assertThat(GraphPromptAssembler.renderBlock(edges, 1)).isSameAs(GraphPromptAssembler.Rendered.EMPTY);
        assertThat(GraphPromptAssembler.renderBlock(List.of(), 800)).isSameAs(GraphPromptAssembler.Rendered.EMPTY);
    }
}
