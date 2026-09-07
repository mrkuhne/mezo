package io.mrkuhne.mezo.feature.admin.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The shipped mezo.admin.memory defaults, and the replay label pinned to its constant (mezo-4qyt). */
class AdminMemoryPropertiesTest extends AbstractIntegrationTest {

    @Autowired private AdminMemoryProperties properties;

    @Test
    void testDefaults_shouldMatchTheShippedYaml_whenContextBoots() {
        assertThat(properties.pcaTargetDims()).isEqualTo(50);
        assertThat(properties.vectorSampleThreshold()).isEqualTo(5000);
        assertThat(properties.neighborDefaultK()).isEqualTo(10);
        assertThat(properties.statementTimeout()).isEqualTo(Duration.ofSeconds(5));
        assertThat(properties.runsMaxPageSize()).isEqualTo(100);
        assertThat(properties.edgeWeightHistogramBuckets()).isEqualTo(10);
    }

    /**
     * The label the admin path binds MUST equal the constant the two companion LLM helpers
     * compare against (Task 1.6) — a rename on one side would silently stop re-labelling the
     * replay's rewrite/rerank rows, and the per-replay cost figure would quietly go wrong.
     */
    @Test
    void testReplayFeatureLabel_shouldEqualTheSharedConstant_whenDefaulted() {
        assertThat(properties.replayFeatureLabel()).isEqualTo(LlmCallContext.FEATURE_ADMIN_REPLAY);
    }

    @Test
    void testStatementTimeoutSql_shouldRenderMilliseconds_whenAskedForSqlForm() {
        assertThat(properties.statementTimeoutSql()).isEqualTo("5000ms");
    }
}
