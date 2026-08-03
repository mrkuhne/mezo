package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.fuel.service.StackPlacementLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the fuel-owned {@link StackPlacementLlm} port (ADR 0012). Gated on
 * BOTH switches (the {@code ActivityClassifier}/{@code ChallengeOutcomeEvaluator} array idiom):
 * with either switch off there is no adapter bean, so {@code PlacementEngine}'s
 * {@code ObjectProvider<StackPlacementLlm>} is empty and placement degrades to the deterministic
 * 'fallback' zone rather than a 500 — no manual flag read needed in the engine itself.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.STACK_PLACEMENT_LLM_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class StackPlacementLlmAdapter implements StackPlacementLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
