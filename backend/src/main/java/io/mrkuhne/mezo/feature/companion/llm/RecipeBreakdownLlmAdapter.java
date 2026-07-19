package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.recipe.service.RecipeBreakdownLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the recipe-owned {@link RecipeBreakdownLlm} port (mezo-bw3y). Recipe
 * defines the seam it needs and never imports {@code feature.companion}; this adapter — living in
 * the companion slice — bridges it to the real {@link CompanionLlm} port, so the only cross-feature
 * dependency runs companion → recipe (ADR 0012; the ArchUnit feature-slice cycle check stays
 * closed).
 *
 * <p>Gated on the companion switch exactly like the scrape/meal-draft adapters: with the companion
 * off there is no bean, and RecipeBreakdownProseService degrades to the deterministic envelope
 * (no prose) — unlike scrape/ai-draft this is a silent degrade, not a 503, because the breakdown
 * endpoint's core is deterministic. Delegates to the cheap-tier two-string overload (ADR 0008).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RecipeBreakdownLlmAdapter implements RecipeBreakdownLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
