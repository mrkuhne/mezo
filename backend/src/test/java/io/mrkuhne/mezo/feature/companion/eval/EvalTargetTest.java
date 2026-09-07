package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EvalTargetTest {

    @Test
    void testOf_shouldRouteGptNamesToOpenAi_whenModelNameIsAGptModel() {
        EvalTarget target = EvalTarget.of("gpt-5.6-luna", true);

        assertThat(target.provider()).isEqualTo(LlmProvider.OPENAI);
        assertThat(target.providerKey()).isEqualTo("openai");
        assertThat(target.apiKeyEnvVar()).isEqualTo("OPENAI_API_KEY");
        assertThat(target.explicit()).isTrue();
    }

    @Test
    void testOf_shouldRouteGeminiNamesToGemini_whenModelNameIsAGeminiModel() {
        EvalTarget target = EvalTarget.of("gemini-2.5-flash", false);

        assertThat(target.provider()).isEqualTo(LlmProvider.GEMINI);
        assertThat(target.providerKey()).isEqualTo("gemini");
        assertThat(target.apiKeyEnvVar()).isEqualTo("GEMINI_API_KEY");
    }

    @Test
    void testOf_shouldRefuseTheRun_whenModelNameBelongsToNoKnownProvider() {
        assertThatThrownBy(() -> EvalTarget.of("mistral-large", true))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("mistral-large");
    }

    @Test
    void testKeyPresentIn_shouldRejectBlankKeys_whenTheEnvVarIsSetButEmpty() {
        EvalTarget target = EvalTarget.of("gpt-5.6-luna", true);

        assertThat(target.keyPresentIn(Map.of("OPENAI_API_KEY", "sk-real"))).isTrue();
        assertThat(target.keyPresentIn(Map.of("OPENAI_API_KEY", "   "))).isFalse();
        assertThat(target.keyPresentIn(Map.of())).isFalse();
    }
}
