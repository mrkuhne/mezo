package io.mrkuhne.mezo.feature.companion.graph.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class GraphEdgeLineRendererTest {

    @Test
    void testRenderLine_shouldRenderCauseVerbEffectAndStrength() {
        String line = GraphEdgeLineRenderer.renderLine(
            GraphEdgeEntity.KIND_TRIGGERS, "Késői evés", "Rossz alvás", new BigDecimal("0.800"));

        assertThat(line).isEqualTo("Késői evés → kiváltja → Rossz alvás · erős");
    }

    @Test
    void testRenderLine_shouldSwapEndpoints_whenKindIsPrecededBy() {
        // stored: Stressz PRECEDED_BY Költözés => Költözés happened first => it leads the line
        String line = GraphEdgeLineRenderer.renderLine(
            GraphEdgeEntity.KIND_PRECEDED_BY, "Stressz", "Költözés", new BigDecimal("0.800"));

        assertThat(line).isEqualTo("Költözés → megelőzte → Stressz · erős");
    }

    @Test
    void testStrength_shouldBucketWeightIntoThreeHungarianWords() {
        assertThat(GraphEdgeLineRenderer.strength(new BigDecimal("0.700"))).isEqualTo("erős");
        assertThat(GraphEdgeLineRenderer.strength(new BigDecimal("0.350"))).isEqualTo("közepes");
        assertThat(GraphEdgeLineRenderer.strength(new BigDecimal("0.100"))).isEqualTo("gyenge");
        assertThat(GraphEdgeLineRenderer.strength(null)).isEqualTo("gyenge");
    }

    @Test
    void testRenderLine_shouldFallBackToRawKind_whenKindUnknown() {
        String line = GraphEdgeLineRenderer.renderLine("MADE_UP", "A", "B", new BigDecimal("0.500"));

        assertThat(line).isEqualTo("A → MADE_UP → B · közepes");
    }
}
