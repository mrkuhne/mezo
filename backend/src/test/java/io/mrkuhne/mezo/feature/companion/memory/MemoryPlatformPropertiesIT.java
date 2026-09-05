package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.validation.BindValidationException;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

class MemoryPlatformPropertiesIT {

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(MemoryPlatformProperties.class)
    static class TestConfig {
    }

    private static final String PREFIX = "mezo.companion.memory-platform.";
    private static final String[] VALID = {
        PREFIX + "serving-embedding-version=v1", PREFIX + "embedding-provider=google",
        PREFIX + "embedding-model=model", PREFIX + "schema-version=1", PREFIX + "serving-mode=shadow",
        PREFIX + "serving.candidate-limit=30", PREFIX + "serving.chat-max-tokens=1200",
        PREFIX + "serving.item-max-chars=600", PREFIX + "reembedding.enabled=false",
        PREFIX + "reembedding.target-version=v1", PREFIX + "reembedding.batch-size=100",
        PREFIX + "reembedding.cron=0 10 4 * * *", PREFIX + "audit.retention-days=30",
        PREFIX + "audit.retention-cron=0 50 3 * * *", PREFIX + "fusion.rrf-constant=60",
        PREFIX + "fusion.retriever-weights.dense=1.0", PREFIX + "fusion.retriever-weights.lexical=1.0",
        PREFIX + "fusion.retriever-weights.facts=1.0", PREFIX + "fusion.retriever-weights.graph=1.0",
        PREFIX + "fusion.pinned-boost=0.005", PREFIX + "fusion.source-reliability-max-boost=0.004",
        PREFIX + "fusion.temporal-max-boost=0.004", PREFIX + "fusion.salience-max-adjustment=0.002",
        PREFIX + "fusion.recency-max-boost=0.003", PREFIX + "execution.retriever-timeout-ms=200",
        PREFIX + "reranker.enabled=false", PREFIX + "reranker.uncertainty-delta=0.002",
        PREFIX + "reranker.max-candidates=20", PREFIX + "reranker.max-content-chars=600",
        PREFIX + "reranker.timeout-ms=200",
        PREFIX + "indicators.old-after-days=365"
    };

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(TestConfig.class);

    @Test
    void testBinding_shouldBindFusionExecutionRerankerAndIndicators_whenValuesAreValid() {
        runner.withPropertyValues(VALID).run(context -> {
            assertThat(context).hasNotFailed();
            MemoryPlatformProperties properties = context.getBean(MemoryPlatformProperties.class);
            assertThat(properties.servingMode()).isEqualTo(RetrievalServingMode.SHADOW);
            assertThat(properties.fusion().rrfConstant()).isEqualTo(60);
            assertThat(properties.fusion().retrieverWeights()).containsEntry("dense", 1.0);
            assertThat(properties.execution().retrieverTimeoutMs()).isEqualTo(200);
            assertThat(properties.reranker().enabled()).isFalse();
            assertThat(properties.reranker().timeoutMs()).isEqualTo(200);
            assertThat(properties.indicators().oldAfterDays()).isEqualTo(365);
        });
    }

    @Test
    void testBinding_shouldFailStartup_whenPositiveBoundsAreZeroOrNegative() {
        assertInvalid(PREFIX + "fusion.rrf-constant=0");
        assertInvalid(PREFIX + "execution.retriever-timeout-ms=0");
        assertInvalid(PREFIX + "reranker.uncertainty-delta=-0.001");
        assertInvalid(PREFIX + "reranker.max-candidates=0");
        assertInvalid(PREFIX + "reranker.timeout-ms=0");
        assertInvalid(PREFIX + "indicators.old-after-days=0");
    }

    private void assertInvalid(String property) {
        runner.withPropertyValues(VALID).withPropertyValues(property).run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(BindValidationException.class);
        });
    }
}
