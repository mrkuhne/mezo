package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.DayReviewLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter for the day-review-owned {@link DayReviewLlm} port (mezo-jcpt.4) — the
 * {@link MealCoachLlmAdapter} shape, on the same cheap tier (ADR 0008).
 *
 * <p>Gated on BOTH switches (the {@link SlotPlanLlmAdapter} two-switch array idiom): with either
 * off there is no bean, {@code DayReviewService}'s {@code ObjectProvider<DayReviewLlm>} is empty,
 * and the day evaluation degrades to its deterministic self with an empty narrative — a silent
 * degrade, never a 503 and never a 5xx, because the six dimensions and the score are complete
 * without any prose at all.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.DAY_REVIEW_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class DayReviewLlmAdapter implements DayReviewLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
