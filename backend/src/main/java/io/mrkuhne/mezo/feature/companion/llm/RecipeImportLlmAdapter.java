package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.recipe.service.RecipeImportLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the recipe-owned {@link RecipeImportLlm} port (ADR 0012). Companion off
 * -> no bean -> the AI reads of the recipe import degrade to a clean 503.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class RecipeImportLlmAdapter implements RecipeImportLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }

    @Override
    public String complete(String systemPrompt, String userMessage, List<Image> images) {
        return companionLlm.complete(systemPrompt, userMessage, images.stream()
            .map(i -> new CompanionLlm.InlineImage(i.bytes(), i.mimeType()))
            .toList());
    }
}
