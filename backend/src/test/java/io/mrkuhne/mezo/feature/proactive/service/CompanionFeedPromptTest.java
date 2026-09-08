package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * mezo-m4m0: the companion FEED's five prose prompts and the three properties that must hold
 * TOGETHER — the informal Hungarian register is pinned, the marker prefix the fake LLM dispatches
 * on stays byte-identical, and the strict-JSON contract stays the LAST instruction.
 *
 * <p>The register rule is what the feed lacked entirely: five non-feed prose prompts
 * ({@code RecipeBreakdownProseService}, {@code QuestFlavor}, {@code MealCoachService},
 * {@code DayReviewService}, {@code QuickNoticeService}) already pinned it inline, which is exactly
 * what made the feed's silence invisible — its register was model chance until a card shipped in
 * formal address ("Önnél", "feküdjön le") between two informal ones.
 *
 * <p>Pure unit test over the constants: the prose itself stays tunable, only these three
 * load-bearing properties are frozen (the {@code MemoirPromptTest} precedent).
 */
class CompanionFeedPromptTest {

    /** The feed prompts that answer strict JSON — the contract that must stay last. */
    private static final List<String> JSON_PROMPTS = List.of(
            CompanionMessageGenerator.MORNING_PROMPT,
            CompanionMessageGenerator.SLEEP_PROMPT,
            CompanionMessageGenerator.WEIGHT_PROMPT,
            CompanionMessageGenerator.PEOPLE_PROMPT);

    private static final String JSON_CONTRACT = "Válaszolj KIZÁRÓLAG szigorú JSON-nal";

    private static final String JSON_TAIL = "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    @Test
    void testFeedPrompts_shouldPinTheInformalRegister() {
        assertThat(JSON_PROMPTS).allSatisfy(prompt ->
                assertThat(prompt).contains(PromptPersona.VOICE_HU));
        assertThat(CompanionMessageGenerator.WINDOW_PROMPT).contains(PromptPersona.VOICE_HU);
    }

    /**
     * The fake LLM dispatches on {@code systemPrompt.startsWith(<marker mirror>)}, so the appended
     * register rule must leave the prefix untouched. Asserted against {@link FakeCompanionLlm}'s
     * MIRROR literals rather than this class' own markers: the mirrors are the condition that
     * actually runs, and a drift between the two silently sends every feed IT down the fake's
     * default branch.
     */
    @Test
    void testFeedPrompts_shouldKeepTheirMarkerPrefix_soTheFakeStillDispatches() {
        assertThat(CompanionMessageGenerator.MORNING_PROMPT)
                .startsWith(FakeCompanionLlm.MORNING_MARKER_MIRROR + "\n");
        assertThat(CompanionMessageGenerator.SLEEP_PROMPT)
                .startsWith(FakeCompanionLlm.SLEEP_MARKER_MIRROR + "\n");
        assertThat(CompanionMessageGenerator.WEIGHT_PROMPT)
                .startsWith(FakeCompanionLlm.WEIGHT_MARKER_MIRROR + "\n");
        assertThat(CompanionMessageGenerator.PEOPLE_PROMPT)
                .startsWith(FakeCompanionLlm.PEOPLE_MARKER_MIRROR + "\n");
        assertThat(CompanionMessageGenerator.WINDOW_PROMPT)
                .startsWith(FakeCompanionLlm.HEARTBEAT_MARKER_MIRROR + "\n");
    }

    /**
     * Ordering, not mere presence: the model follows the LAST formatting instruction it read, so a
     * register rule appended AFTER the strict-JSON contract would trade a register defect for a
     * parse defect (an unparseable answer persists no row at all).
     */
    @Test
    void testJsonFeedPrompts_shouldKeepTheJsonContractAfterTheRegisterRule() {
        assertThat(JSON_PROMPTS).allSatisfy(prompt -> {
            assertThat(prompt.indexOf(PromptPersona.VOICE_HU))
                    .isGreaterThanOrEqualTo(0)
                    .isLessThan(prompt.indexOf(JSON_CONTRACT));
            assertThat(prompt).endsWith(JSON_TAIL);
        });
    }

    /** The window note answers flat prose — it has no JSON contract to stay behind, so there the
     *  register rule is the template's last word. */
    @Test
    void testWindowPrompt_shouldEndWithTheRegisterRule() {
        assertThat(CompanionMessageGenerator.WINDOW_PROMPT)
                .endsWith(PromptPersona.VOICE_HU)
                .doesNotContain(JSON_CONTRACT);
    }
}
