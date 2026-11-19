package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.penz.service.PenzSmsLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter for the penz-owned {@link PenzSmsLlm} port (Boop Pénz L4, mezo-r36n9.102) — the
 * {@link DayCloseLlmAdapter} shape, on the same cheap tier (ADR 0008). Companion off ⇒ no bean ⇒ a money-looking
 * SMS is stored {@code failed/llm_error}.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PenzSmsLlmAdapter implements PenzSmsLlm {

    private final CompanionLlm companionLlm;

    @Override
    public String complete(String systemPrompt, String userMessage) {
        return companionLlm.complete(systemPrompt, userMessage);
    }
}
