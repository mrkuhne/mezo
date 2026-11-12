package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.dayclose.service.DayCloseLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter for the dayclose-owned {@link DayCloseLlm} port (Boop B3, mezo-r36n9.13) — the
 * {@link DayReviewLlmAdapter} shape, on the same cheap tier (ADR 0008). Companion off ⇒ no bean ⇒ the line
 * endpoints answer 503 and the phone retries later.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DayCloseLlmAdapter implements DayCloseLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
