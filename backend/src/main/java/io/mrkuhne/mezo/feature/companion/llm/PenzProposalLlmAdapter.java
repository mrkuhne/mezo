package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.penz.service.PenzProposalLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter for the penz-owned {@link PenzProposalLlm} port (Boop Pénz L7, mezo-r36n9.105) — the
 * {@link PenzDigestLlmAdapter} shape on the same cheap tier (ADR 0008): one call per proposal he asks for, prose the
 * deterministic validator re-checks anyway. Tags the call {@code penz_proposal/narrate} (payload-free audit,
 * {@link LlmCallContext#keepsPayload}); a budget refusal or provider failure is an empty answer, never an exception,
 * so the proposal falls back to fixed copy instead of failing. Companion off ⇒ no bean.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PenzProposalLlmAdapter implements PenzProposalLlm {

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;

    @Override
    public Optional<String> narrate(String systemPrompt, String userMessage) {
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext(LLM_FEATURE, LLM_OPERATION, null, null),
                () -> companionLlm.complete(systemPrompt, userMessage));
            return raw == null || raw.isBlank() ? Optional.empty() : Optional.of(raw);
        } catch (RuntimeException e) {
            // never the prompt or the answer: provider errors can carry the request
            log.warn("Penz proposal narration failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
