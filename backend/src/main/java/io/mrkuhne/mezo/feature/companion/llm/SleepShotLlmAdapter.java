package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepShotLlm;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Companion-side adapter for the sleep screenshot port (ADR 0012) — companion -> sleep edge only. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SleepShotLlmAdapter implements SleepShotLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType) {
        return companionLlm.complete(systemPrompt, userMessage,
            List.of(new CompanionLlm.InlineImage(imageBytes, mimeType)));
    }
}
