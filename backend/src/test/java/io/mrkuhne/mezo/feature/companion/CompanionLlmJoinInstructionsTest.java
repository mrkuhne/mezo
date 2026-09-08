package io.mrkuhne.mezo.feature.companion;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * mezo-ozri.5: the prompt split is only safe while the two halves re-join into exactly the ONE
 * string the chat prompt used to be. That identity is load-bearing in three places at once — the
 * {@code llm_log.system_prompt} audit column, {@code FakeCompanionLlm}'s {@code startsWith}
 * dispatch, and the {@code system=[…]} echo dozens of chat ITs assert on — so it is pinned here
 * rather than left to be re-discovered when one of them turns red.
 */
class CompanionLlmJoinInstructionsTest {

    @Test
    void testJoinInstructions_shouldConcatenateWithNothingBetween_whenBothHalvesArePresent() {
        assertThat(CompanionLlm.joinInstructions("RENDSZER", "[Ma] friss adat"))
                .isEqualTo("RENDSZER[Ma] friss adat");
    }

    @Test
    void testJoinInstructions_shouldReturnTheStableHalfUnchanged_whenTheVolatileHalfIsNull() {
        assertThat(CompanionLlm.joinInstructions("RENDSZER", null)).isEqualTo("RENDSZER");
    }

    /** Blank is "nothing to add", not "add whitespace" — otherwise every tool-less call would drift. */
    @Test
    void testJoinInstructions_shouldReturnTheStableHalfUnchanged_whenTheVolatileHalfIsBlank() {
        assertThat(CompanionLlm.joinInstructions("RENDSZER", "   \n ")).isEqualTo("RENDSZER");
    }
}
