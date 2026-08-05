package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.fuel.service.SlotPlanLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the fuel-owned {@link SlotPlanLlm} port (ADR 0012). Gated on BOTH
 * switches (the {@code StackPlacementLlmAdapter} two-switch array idiom): with either switch off
 * there is no adapter bean, so {@code SlotPlanEvaluationService}'s {@code ObjectProvider<SlotPlanLlm>}
 * is empty and the evaluate endpoint degrades to a clean 503 rather than a 500 — no manual flag
 * read needed in the service itself.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.SLOT_TEMPLATE_AI_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class SlotPlanLlmAdapter implements SlotPlanLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
