package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
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
        PREFIX + "indicators.old-after-days=365",
        PREFIX + "policies.reflection.candidate-limit=30", PREFIX + "policies.reflection.max-tokens=800",
        PREFIX + "policies.reflection.rerank=true",
        PREFIX + "policies.morning-briefing.enabled=true", PREFIX + "policies.morning-briefing.candidate-limit=20",
        PREFIX + "policies.morning-briefing.max-tokens=600", PREFIX + "policies.morning-briefing.rerank=false",
        PREFIX + "policies.morning-briefing.deep=false",
        PREFIX + "policies.weekly-memoir.enabled=true", PREFIX + "policies.weekly-memoir.candidate-limit=30",
        PREFIX + "policies.weekly-memoir.max-tokens=1200", PREFIX + "policies.weekly-memoir.rerank=true",
        PREFIX + "policies.weekly-memoir.deep=true",
        PREFIX + "policies.prediction-evidence.enabled=true", PREFIX + "policies.prediction-evidence.candidate-limit=30",
        PREFIX + "policies.prediction-evidence.max-tokens=800", PREFIX + "policies.prediction-evidence.rerank=true",
        PREFIX + "policies.prediction-evidence.deep=false",
        PREFIX + "policies.similar-days.enabled=true", PREFIX + "policies.similar-days.candidate-limit=30",
        PREFIX + "policies.similar-days.max-tokens=600", PREFIX + "policies.similar-days.rerank=false",
        PREFIX + "policies.similar-days.deep=false",
        PREFIX + "policies.character-evidence.enabled=true", PREFIX + "policies.character-evidence.candidate-limit=30",
        PREFIX + "policies.character-evidence.max-tokens=1200", PREFIX + "policies.character-evidence.rerank=true",
        PREFIX + "policies.character-evidence.deep=true",
        PREFIX + "policies.extraction.enabled=true", PREFIX + "policies.extraction.candidate-limit=10",
        PREFIX + "policies.extraction.max-tokens=300", PREFIX + "policies.extraction.rerank=false",
        PREFIX + "policies.extraction.deep=false",
        PREFIX + "policies.personal-context.enabled=true", PREFIX + "policies.personal-context.candidate-limit=15",
        PREFIX + "policies.personal-context.max-tokens=400", PREFIX + "policies.personal-context.rerank=false",
        PREFIX + "policies.personal-context.deep=false"
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
            assertThat(properties.policies().reflection().candidateLimit()).isEqualTo(30);
            assertThat(properties.policies().reflection().maxTokens()).isEqualTo(800);
            assertThat(properties.policies().reflection().rerank()).isTrue();
            assertThat(properties.policies().morningBriefing().candidateLimit()).isEqualTo(20);
            assertThat(properties.policies().morningBriefing().maxTokens()).isEqualTo(600);
            assertThat(properties.policies().morningBriefing().rerank()).isFalse();
            assertThat(properties.policies().weeklyMemoir().rerank()).isTrue();
            assertThat(properties.policies().weeklyMemoir().deep()).isTrue();
            assertThat(properties.policies().characterEvidence().deep()).isTrue();
            assertThat(properties.policies().extraction().candidateLimit()).isEqualTo(10);
            assertThat(properties.policies().personalContext().maxTokens()).isEqualTo(400);
        });
    }

    @Test
    void testLimitsFor_shouldMapEveryConsumerPolicyToItsConfiguredLimits() {
        runner.withPropertyValues(VALID).run(context -> {
            MemoryPlatformProperties properties = context.getBean(MemoryPlatformProperties.class);
            assertThat(properties.limitsFor(ConsumerPolicy.REFLECTION).enabled()).isTrue();
            assertThat(properties.limitsFor(ConsumerPolicy.REFLECTION).candidateLimit()).isEqualTo(30);
            assertThat(properties.limitsFor(ConsumerPolicy.REFLECTION).maxTokens()).isEqualTo(800);
            assertThat(properties.limitsFor(ConsumerPolicy.REFLECTION).rerank()).isTrue();
            assertThat(properties.limitsFor(ConsumerPolicy.CHAT_AMBIENT).enabled()).isTrue();
            assertThat(properties.limitsFor(ConsumerPolicy.CHAT_AMBIENT).candidateLimit())
                    .isEqualTo(properties.serving().candidateLimit());
            assertThat(properties.limitsFor(ConsumerPolicy.CHAT_AMBIENT).maxTokens())
                    .isEqualTo(properties.serving().chatMaxTokens());
            assertThat(properties.limitsFor(ConsumerPolicy.CHAT_AMBIENT).rerank()).isFalse();
            assertThat(properties.limitsFor(ConsumerPolicy.MORNING_BRIEFING))
                    .isEqualTo(properties.policies().morningBriefing());
            assertThat(properties.limitsFor(ConsumerPolicy.WEEKLY_MEMOIR))
                    .isEqualTo(properties.policies().weeklyMemoir());
            assertThat(properties.limitsFor(ConsumerPolicy.PREDICTION_EVIDENCE))
                    .isEqualTo(properties.policies().predictionEvidence());
            assertThat(properties.limitsFor(ConsumerPolicy.SIMILAR_DAYS))
                    .isEqualTo(properties.policies().similarDays());
            assertThat(properties.limitsFor(ConsumerPolicy.CHARACTER_EVIDENCE))
                    .isEqualTo(properties.policies().characterEvidence());
            assertThat(properties.limitsFor(ConsumerPolicy.EXTRACTION))
                    .isEqualTo(properties.policies().extraction());
            assertThat(properties.limitsFor(ConsumerPolicy.PERSONAL_CONTEXT))
                    .isEqualTo(properties.policies().personalContext());
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
        assertInvalid(PREFIX + "policies.reflection.candidate-limit=0");
        assertInvalid(PREFIX + "policies.reflection.max-tokens=59");
        assertInvalid(PREFIX + "policies.morning-briefing.candidate-limit=0");
        assertInvalid(PREFIX + "policies.morning-briefing.max-tokens=59");
    }

    @Test
    void testBinding_shouldFailStartup_whenReflectionPolicyBoundsExceedTheirUpperLimit() {
        assertInvalid(PREFIX + "policies.reflection.candidate-limit=101");
        assertInvalid(PREFIX + "policies.reflection.max-tokens=6001");
    }

    private void assertInvalid(String property) {
        runner.withPropertyValues(VALID).withPropertyValues(property).run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure()).hasRootCauseInstanceOf(BindValidationException.class);
        });
    }
}
