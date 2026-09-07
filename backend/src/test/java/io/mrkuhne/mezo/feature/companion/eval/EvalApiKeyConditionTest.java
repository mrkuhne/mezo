package io.mrkuhne.mezo.feature.companion.eval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;
import org.junit.jupiter.api.Test;

class EvalApiKeyConditionTest {

    @Test
    void testDecide_shouldEnable_whenTheTargetProvidersKeyIsPresent() {
        var result = EvalApiKeyCondition.decide(
            EvalTarget.of("gpt-5.6-luna", true), Map.of("OPENAI_API_KEY", "sk-real"));

        assertThat(result.isDisabled()).isFalse();
    }

    @Test
    void testDecide_shouldSkipQuietly_whenNoModelWasRequestedAndTheIncumbentKeyIsAbsent() {
        var result = EvalApiKeyCondition.decide(EvalTarget.of("gemini-2.5-flash", false), Map.of());

        assertThat(result.isDisabled()).isTrue();
        assertThat(result.getReason()).get().asString().contains("GEMINI_API_KEY");
    }

    @Test
    void testDecide_shouldFailLoudly_whenAModelWasRequestedButItsProvidersKeyIsAbsent() {
        assertThatThrownBy(() -> EvalApiKeyCondition.decide(
                EvalTarget.of("gpt-5.6-luna", true), Map.of("GEMINI_API_KEY", "present")))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("OPENAI_API_KEY")
            .hasMessageContaining("gpt-5.6-luna");
    }
}
