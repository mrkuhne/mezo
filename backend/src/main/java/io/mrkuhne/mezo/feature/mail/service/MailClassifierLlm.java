package io.mrkuhne.mezo.feature.mail.service;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import java.util.Optional;

/**
 * Port for Boop Levél's three model calls (mezo-r36n9.38, spec §5.4): the prompt in, the model's raw JSON text out —
 * or empty when the model is unavailable, over budget or failed (the pipeline then falls back to rules-only
 * grouping). {@code MailOutputValidator} re-checks every answer. Implemented in {@code feature/companion} on the
 * cheap chat tier and tagged with the slugs below (payload-free in the audit log); with the companion off there is no
 * bean. Lives here so mail never imports companion.
 */
public interface MailClassifierLlm {

    String FEATURE_CLASSIFY = LlmCallContext.FEATURE_MAIL_CLASSIFY;
    String FEATURE_SCORE = LlmCallContext.FEATURE_MAIL_SCORE;
    String FEATURE_SCREEN = LlmCallContext.FEATURE_MAIL_SCREEN;

    /** Classify + extract one mail. */
    Optional<String> classify(String systemPrompt, String userMessage);

    /** Score a batch of deal candidates. */
    Optional<String> score(String systemPrompt, String userMessage);

    /** Phishing / injection screen of one item. */
    Optional<String> screen(String systemPrompt, String userMessage);
}
