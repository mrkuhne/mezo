package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Spec §8.3 of the OpenAI migration: an adapter that INHERITS a smart entry point sends the call
 * to the cheap tier silently, with no error anywhere. {@code completeSmart(String, String)} is
 * already guarded structurally; these two new entry points need the same guard.
 */
class SpringAiSmartTurnOverrideTest {

    @Test
    void testSpringAiCompanionLlm_shouldOverrideBothSmartTurnEntryPoints_whenTheSeamIsWired()
            throws NoSuchMethodException {
        assertThat(SpringAiCompanionLlm.class
            .getDeclaredMethod("completeSmart", String.class, String.class, List.class, String.class)
            .getDeclaringClass())
            .isEqualTo(SpringAiCompanionLlm.class);
        assertThat(SpringAiCompanionLlm.class
            .getDeclaredMethod("streamSmart", String.class, String.class, List.class, String.class)
            .getDeclaringClass())
            .isEqualTo(SpringAiCompanionLlm.class);
        // Both halves of the premise: the port's own entry points ARE defaults, which is exactly
        // why an adapter that forgets to override one drops to the cheap tier in silence. Asserting
        // it for completeSmart alone would leave streamSmart's guard resting on an unchecked claim.
        assertThat(CompanionLlm.class
            .getDeclaredMethod("completeSmart", String.class, String.class, List.class, String.class)
            .isDefault())
            .isTrue();
        assertThat(CompanionLlm.class
            .getDeclaredMethod("streamSmart", String.class, String.class, List.class, String.class)
            .isDefault())
            .isTrue();
    }
}
