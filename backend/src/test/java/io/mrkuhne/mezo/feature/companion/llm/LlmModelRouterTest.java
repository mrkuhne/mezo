package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm.Tier;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The routing table's whole contract (mezo-ozri.4). Pure unit: the router never calls a provider,
 * it answers "which model id" from config plus the ambient feature slug.
 */
class LlmModelRouterTest {

    private final LlmCallContextHolder contextHolder = new LlmCallContextHolder();

    @Test
    void testModelFor_shouldReturnTheTierDefault_whenNothingIsOverridden() {
        LlmModelRouter router = router(tier(Map.of(), Map.of()));

        assertThat(router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT)).isEqualTo("luna");
        assertThat(router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART)).isEqualTo("terra");
    }

    @Test
    void testModelFor_shouldUseTheFeatureOverride_whenTheAmbientFeatureMatches() {
        LlmModelRouter router = router(tier(Map.of("companion_weekly_review", "terra"), Map.of()));

        String model = contextHolder.runWith(new LlmCallContext("companion_weekly_review", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("terra");
    }

    @Test
    void testModelFor_shouldFallBackToTheTierDefault_whenTheFeatureIsUnknownOrUntagged() {
        LlmModelRouter router = router(tier(Map.of("companion_weekly_review", "terra"), Map.of()));

        assertThat(router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT)).isEqualTo("luna");
        assertThat(contextHolder.runWith(new LlmCallContext("fuel_meal_ai", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT))).isEqualTo("luna");
    }

    @Test
    void testModelFor_shouldLetTheCallKindWin_whenBothOverridesMatch() {
        // A call-kind entry states a capability the model must HAVE; a feature entry states a
        // preference. Capability beats preference, or a feature override could send a vision turn
        // to a text-only model.
        LlmModelRouter router = router(tier(Map.of("companion_chat", "terra"), Map.of(CallKind.VISION, "luna-vision")));

        String model = contextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.VISION));

        assertThat(model).isEqualTo("luna-vision");
    }

    @Test
    void testModelFor_shouldNeverCrossProviders_soAGeminiCallCannotAskForAGptModel() {
        LlmModelRouter router = router(tier(Map.of("companion_chat", "terra"), Map.of()));

        String model = contextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.GEMINI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("flash");
    }

    @Test
    void testModelFor_shouldIgnoreABlankOverride_becauseConfigMayNeverFailACall() {
        LlmModelRouter router = router(tier(Map.of("companion_chat", "  "), Map.of()));

        String model = contextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("luna");
    }

    @Test
    void testReasoningEffortFor_shouldReturnThePerTierValue_orNullWhenUnset() {
        LlmModelRouter router = router(tier(Map.of(), Map.of()));

        assertThat(router.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.CHEAP)).isEqualTo("low");
        assertThat(router.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.SMART)).isEqualTo("medium");
        assertThat(router.reasoningEffortFor(LlmProvider.GEMINI, ModelTier.CHEAP)).isNull();
    }

    private LlmModelRouter router(Tier openai) {
        Tier gemini = new Tier("flash", "pro", Map.of(), Map.of(), new Tier.ReasoningEffort(null, null));
        return new LlmModelRouter(gemini, openai, contextHolder);
    }

    private static Tier tier(Map<String, String> featureModels, Map<CallKind, String> callKindModels) {
        return new Tier("luna", "terra", featureModels, callKindModels,
            new Tier.ReasoningEffort("low", "medium"));
    }
}
