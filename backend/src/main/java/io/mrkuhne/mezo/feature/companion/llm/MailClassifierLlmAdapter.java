package io.mrkuhne.mezo.feature.companion.llm;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.mail.service.MailClassifierLlm;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter for the mail-owned {@link MailClassifierLlm} port (Boop Levél, mezo-r36n9.38) — the
 * {@link PenzDigestLlmAdapter} shape, on the same cheap tier (ADR 0008): short structured answers the validator
 * re-checks anyway. Tags each call {@code mail_classify|mail_score|mail_screen} (payload-free audit,
 * {@link LlmCallContext#keepsPayload}); a budget refusal or provider failure is an empty answer, never an exception,
 * so the run falls back to rules-only grouping. Companion off means no bean.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MailClassifierLlmAdapter implements MailClassifierLlm {

    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;

    @Override
    public Optional<String> classify(String systemPrompt, String userMessage) {
        return call(FEATURE_CLASSIFY, "classify", systemPrompt, userMessage);
    }

    @Override
    public Optional<String> score(String systemPrompt, String userMessage) {
        return call(FEATURE_SCORE, "score", systemPrompt, userMessage);
    }

    @Override
    public Optional<String> screen(String systemPrompt, String userMessage) {
        return call(FEATURE_SCREEN, "screen", systemPrompt, userMessage);
    }

    private Optional<String> call(String feature, String operation, String systemPrompt, String userMessage) {
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext(feature, operation, null, null),
                () -> companionLlm.complete(systemPrompt, userMessage));
            return raw == null || raw.isBlank() ? Optional.empty() : Optional.of(raw);
        } catch (RuntimeException e) {
            // never the prompt or the answer: provider errors can carry the request (a mail body)
            log.warn("Mail {} call failed: {}", operation, e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
