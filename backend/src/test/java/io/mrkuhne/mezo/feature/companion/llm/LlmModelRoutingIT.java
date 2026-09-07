package io.mrkuhne.mezo.feature.companion.llm;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-ozri.4 acceptance: moving one feature or one call kind onto another model is a YAML edit and
 * nothing else. Proven through the REAL binder, because the failure mode this guards is a binding
 * one — a feature slug carries underscores, and an unbracketed map key gets relaxed-bound into
 * something that never matches, silently leaving every call on the tier default.
 */
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.companion.llm.openai.feature-models.[companion_weekly_review]=gpt-5.6-terra",
    "mezo.companion.llm.openai.call-kind-models.VISION=gpt-5.6-luna-vision",
    // The shipped yaml is the other way round (chat=high, smart empty, mezo-641c) — deliberately
    // inverted here so BOTH branches are exercised: a set tier and an emptied one.
    "mezo.companion.llm.openai.reasoning-effort.smart=high",
    "mezo.companion.llm.openai.reasoning-effort.chat="
})
class LlmModelRoutingIT extends AbstractIntegrationTest {

    @Autowired private LlmModelRouter llmModelRouter;
    @Autowired private LlmCallContextHolder llmCallContextHolder;

    @Test
    void testRouting_shouldHonourAFeatureOverrideFromConfig_withoutARecompile() {
        String model = llmCallContextHolder.runWith(
            new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("gpt-5.6-terra");
    }

    @Test
    void testRouting_shouldHonourACallKindOverride_evenInsideAnOverriddenFeature() {
        String model = llmCallContextHolder.runWith(
            new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.VISION));

        assertThat(model).isEqualTo("gpt-5.6-luna-vision");
    }

    @Test
    void testRouting_shouldFallBackToTheTierDefault_forEveryUnconfiguredFeature() {
        String model = llmCallContextHolder.runWith(new LlmCallContext("companion_chat", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.OPENAI, ModelTier.CHEAP, CallKind.CHAT));

        assertThat(model).isEqualTo("gpt-5.6-luna");
    }

    /** Spec §A1: the Gemini adapter still answers the delegated audio/vision calls — with GEMINI ids. */
    @Test
    void testRouting_shouldNotLeakOverridesAcrossProviders_soDelegatedMediaStaysOnGemini() {
        String model = llmCallContextHolder.runWith(
            new LlmCallContext("companion_weekly_review", null, null, null),
            () -> llmModelRouter.modelFor(LlmProvider.GEMINI, ModelTier.CHEAP, CallKind.TRANSCRIBE));

        assertThat(model).isEqualTo("gemini-2.5-flash");
    }

    @Test
    void testReasoningEffort_shouldBindPerTier_andStayUnsetWhereTheYamlLeavesItEmpty() {
        // CHEAP is null here only because this class blanks it: an empty property binds to "" and
        // the router must read blank as unset, which is what keeps a tier off the wire entirely.
        assertThat(llmModelRouter.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.SMART)).isEqualTo("high");
        assertThat(llmModelRouter.reasoningEffortFor(LlmProvider.OPENAI, ModelTier.CHEAP)).isNull();
    }
}
