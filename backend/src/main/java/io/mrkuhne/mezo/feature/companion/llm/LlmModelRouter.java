package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.config.LlmProvider;
import io.mrkuhne.mezo.feature.companion.config.ModelTier;
import io.mrkuhne.mezo.feature.llmlog.context.LlmBudgetLevel;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Which model id serves THIS call (mezo-ozri.4, spec §R1). Until this bean existed the answer was
 * frozen at wiring time — {@code SpringAiCompanionLlm} built one ChatClient per tier — so moving a
 * single feature onto a different model meant a code change and a deploy.
 *
 * <p>It needs no new plumbing at any call site: the feature slug is already ambient in
 * {@link LlmCallContextHolder} (the first constructor argument of all 56 tagged calls) and the
 * {@link CallKind} is already computed on the adapter's method heads. The router reads the slug
 * itself, so no adapter has to remember to pass it.
 *
 * <p><b>Precedence:</b> call-kind override, then — since mezo-ozri.6 — the budget degrade target,
 * then feature override, then the tier default. A kind
 * states a capability the model must HAVE (an audio route, an image input); a feature only states a
 * preference, so capability wins — otherwise "run this feature on the text model" would silently
 * break that feature's vision turn. Anything unmatched, unknown or blank falls through to the tier
 * default: configuration may never be the reason a user's call fails.
 *
 * <p><b>Provider-scoped by construction.</b> Overrides live inside a provider's own config block, so
 * a Gemini call can never resolve a GPT id — which matters because {@code OpenAiCompanionLlm}
 * delegates audio and vision to the Gemini adapter (spec §A1).
 */
@Component
public class LlmModelRouter {

    private final CompanionProperties.Llm.Tier gemini;
    private final CompanionProperties.Llm.Tier openai;
    private final LlmCallContextHolder llmCallContextHolder;

    /** {@code @Autowired} because the second constructor — the one the unit tests build tables with
     *  — makes the choice ambiguous otherwise. */
    @Autowired
    public LlmModelRouter(CompanionProperties companionProperties, LlmCallContextHolder llmCallContextHolder) {
        this(companionProperties.llm().gemini(), companionProperties.llm().openai(), llmCallContextHolder);
    }

    LlmModelRouter(CompanionProperties.Llm.Tier gemini, CompanionProperties.Llm.Tier openai,
                   LlmCallContextHolder llmCallContextHolder) {
        this.gemini = gemini;
        this.openai = openai;
        this.llmCallContextHolder = llmCallContextHolder;
    }

    /** Never null and never blank: the tier default is the floor. */
    public String modelFor(LlmProvider provider, ModelTier tier, CallKind kind) {
        CompanionProperties.Llm.Tier config = configOf(provider);
        String byKind = config.callKindModels().get(kind);
        if (StringUtils.hasText(byKind)) {
            return byKind.trim();
        }
        // mezo-ozri.6: past the degrade threshold the cheap tier is the ONLY answer. Feature
        // overrides are skipped deliberately — a feature entry is a preference, and honouring one
        // here would let a single yml line turn the degrade step into a no-op. The call-kind branch
        // above still wins, because that one states a capability the model must HAVE.
        if (llmCallContextHolder.budgetLevel().atLeast(LlmBudgetLevel.DEGRADED)) {
            return StringUtils.hasText(config.degradeModel())
                ? config.degradeModel().trim() : config.chatModel();
        }
        String byFeature = config.featureModels().get(llmCallContextHolder.get().feature());
        if (StringUtils.hasText(byFeature)) {
            return byFeature.trim();
        }
        return tier == ModelTier.SMART ? config.smartModel() : config.chatModel();
    }

    /** {@code null} = send no reasoning effort at all, leaving the provider's own default in place. */
    public String reasoningEffortFor(LlmProvider provider, ModelTier tier) {
        CompanionProperties.Llm.Tier.ReasoningEffort effort = configOf(provider).reasoningEffort();
        String value = tier == ModelTier.SMART ? effort.smart() : effort.chat();
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private CompanionProperties.Llm.Tier configOf(LlmProvider provider) {
        return provider == LlmProvider.OPENAI ? openai : gemini;
    }
}
