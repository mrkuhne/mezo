package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.meal.service.MealCoachLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the meal-owned {@link MealCoachLlm} port (mezo-mr4n) — the
 * {@link RecipeBreakdownLlmAdapter} shape. Meal defines the seam it needs and never imports
 * {@code feature.companion}; this adapter bridges it to the real {@link CompanionLlm}, so the only
 * cross-feature dependency runs companion → meal, the direction the graph already runs (ADR 0012;
 * the ArchUnit feature-slice cycle check stays closed).
 *
 * <p>Gated on the companion switch like every other adapter here: with the companion off there is
 * no bean and {@code MealCoachService} degrades to no verdicts — a silent degrade, not a 503,
 * because the meal score itself is deterministic and already served. Cheap tier (ADR 0008).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MealCoachLlmAdapter implements MealCoachLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
