package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.pantry.service.ScrapeLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the pantry-owned {@link ScrapeLlm} port (mezo-8vum). Pantry defines the
 * seam it needs and never imports {@code feature.companion}; this adapter — living in the companion
 * slice — bridges it to the real {@link CompanionLlm} port, so the only cross-feature dependency
 * runs companion → pantry (the ArchUnit feature-slice cycle check stays closed).
 *
 * <p>Gated on the companion switch exactly like every other {@code CompanionLlm} consumer: with the
 * companion off there is no {@code CompanionLlm} bean and therefore no {@code ScrapeLlm} bean, which
 * is what makes the scrape endpoint degrade to a clean 503 (see {@code ScrapeExtractionService
 * #requireAvailable}). Delegates to the cheap-tier two-string overload (ADR 0008 model tiers).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PantryScrapeLlmAdapter implements ScrapeLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
