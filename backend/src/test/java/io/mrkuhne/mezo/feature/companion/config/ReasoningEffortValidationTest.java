package io.mrkuhne.mezo.feature.companion.config;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm.Tier.ReasoningEffort;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

/**
 * The reasoning-effort enumeration is a CONTRACT WITH THE PROVIDER, not a taste question: an
 * accepted-here-but-rejected-there value turns every companion call on that tier into an HTTP 400
 * outage, and it would do so at the first real request rather than at boot.
 *
 * <p>The five accepted values were probed live against both GPT-5.6 tiers (mezo-641c S0). The two
 * that are pinned as REJECTED here — {@code minimal} and {@code max} — came from second-hand
 * information, shipped in the first draft of the pattern, and are answered by the API with
 * <i>"Unsupported value: 'reasoning_effort' does not support 'minimal' with this model. Supported
 * values are: 'none', 'low', 'medium', 'high', and 'xhigh'."</i> If a future model widens the set,
 * re-probe before widening the pattern — this test is the record of what was actually measured.
 */
class ReasoningEffortValidationTest {

    private static boolean valid(String chat, String smart) {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();
            return validator.validate(new ReasoningEffort(chat, smart)).isEmpty();
        }
    }

    @Test
    void testValidation_shouldAcceptEveryLevelTheProviderAnswered() {
        for (String level : new String[] {"none", "low", "medium", "high", "xhigh"}) {
            assertThat(valid(level, level)).as("provider-accepted level %s", level).isTrue();
        }
    }

    @Test
    void testValidation_shouldAcceptBlankAndNull_becauseThatIsTheShippedUnsetState() {
        // An empty yml key (`chat:`) binds to "", not null — both must pass, or the shipped
        // application.yml fails to boot.
        assertThat(valid(null, null)).isTrue();
        assertThat(valid("", "")).isTrue();
    }

    @Test
    void testValidation_shouldRejectTheLevelsTheProviderAnswersWith400() {
        assertThat(valid("minimal", null)).isFalse();
        assertThat(valid(null, "max")).isFalse();
        assertThat(valid("MEDIUM", null)).isFalse(); // the SDK lowercases, but a typo must not ship
    }
}
