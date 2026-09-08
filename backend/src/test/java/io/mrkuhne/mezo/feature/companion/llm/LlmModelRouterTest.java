package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties.Llm.Tier;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetGate;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
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
        return new LlmModelRouter(gemini(), openai, contextHolder);
    }

    private static Tier gemini() {
        return new Tier("flash", "pro", null, Map.of(), Map.of(), new Tier.ReasoningEffort(null, null));
    }

    private static Tier tier(Map<String, String> featureModels, Map<CallKind, String> callKindModels) {
        return tier(null, featureModels, callKindModels);
    }

    private static Tier tier(String degradeModel, Map<String, String> featureModels,
                             Map<CallKind, String> callKindModels) {
        return new Tier("luna", "terra", degradeModel, featureModels, callKindModels,
            new Tier.ReasoningEffort("low", "medium"));
    }

    /** A holder whose gate reports one fixed level — the router only ever reads the bound level. */
    private static LlmCallContextHolder holderAt(LlmBudgetLevel level) {
        return new LlmCallContextHolder(new LlmBudgetGate() {
            @Override
            public LlmBudgetLevel levelFor(String feature) {
                return level;
            }
        });
    }

    /**
     * The 70% step (mezo-ozri.6): a degraded call drops onto the provider's cheap tier even when it
     * asked for the smart one. Same price per token, an order of magnitude fewer dollars.
     */
    @Test
    void testModelFor_shouldFallToTheCheapTier_whenTheBudgetIsDegraded() {
        LlmCallContextHolder degraded = holderAt(LlmBudgetLevel.DEGRADED);
        LlmModelRouter router = new LlmModelRouter(gemini(), tier(Map.of(), Map.of()), degraded);

        String model = degraded.runWith(new LlmCallContext("companion_weekly_review", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART));

        assertThat(model).isEqualTo("luna");
    }

    /**
     * A feature override states a PREFERENCE and is dropped under budget pressure — honouring it
     * would let one yml line turn the degrade step into a no-op. A call-kind override states a
     * CAPABILITY and survives: dropping the vision model on a degraded turn breaks the turn, it does
     * not save money.
     */
    @Test
    void testModelFor_shouldDropFeatureOverridesButKeepCallKindOnes_whenDegraded() {
        LlmCallContextHolder degraded = holderAt(LlmBudgetLevel.DEGRADED);
        LlmModelRouter router = new LlmModelRouter(gemini(),
            tier(Map.of("companion_chat", "terra"), Map.of(CallKind.VISION, "luna-vision")), degraded);
        LlmCallContext chat = new LlmCallContext("companion_chat", null, null, null);

        assertThat(degraded.runWith(chat,
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT))).isEqualTo("luna");
        assertThat(degraded.runWith(chat,
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.VISION))).isEqualTo("luna-vision");
    }

    /** An explicit degrade-model beats the cheap-tier default — provider-scoped, per spec §7. */
    @Test
    void testModelFor_shouldUseTheDegradeModel_whenOneIsConfigured() {
        LlmCallContextHolder degraded = holderAt(LlmBudgetLevel.DEGRADED);
        LlmModelRouter router = new LlmModelRouter(gemini(),
            tier("luna-mini", Map.of(), Map.of()), degraded);

        assertThat(degraded.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART))).isEqualTo("luna-mini");
    }

    /** Below the threshold nothing changes — the smart tier still answers a smart-tier call. */
    @Test
    void testModelFor_shouldLeaveRoutingAlone_whenTheBudgetIsOk() {
        LlmCallContextHolder ok = holderAt(LlmBudgetLevel.OK);
        LlmModelRouter router = new LlmModelRouter(gemini(),
            tier("luna-mini", Map.of(), Map.of()), ok);

        assertThat(ok.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> router.modelFor(LlmProvider.OPENAI, ModelTier.SMART, CallKind.SMART))).isEqualTo("terra");
    }
}
