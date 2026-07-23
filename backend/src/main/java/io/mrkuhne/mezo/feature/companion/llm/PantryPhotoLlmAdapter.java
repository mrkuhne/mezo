package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.pantry.service.PhotoExtractLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Companion-side adapter for the pantry-owned {@link PhotoExtractLlm} port (mezo-d8tr, ADR 0012).
 * Companion off -> no CompanionLlm bean -> no adapter bean -> the photo endpoint degrades to a
 * clean 503 via ObjectProvider (same story as {@link PantryScrapeLlmAdapter}).
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PantryPhotoLlmAdapter implements PhotoExtractLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage, List<Image> images) {
        return companionLlm.complete(systemPrompt, userMessage, images.stream()
            .map(i -> new CompanionLlm.InlineImage(i.bytes(), i.mimeType()))
            .toList());
    }
}
