package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import java.util.Optional;

/**
 * Port for the daily news digest narration (Boop Pénz L6, mezo-r36n9.104, build notes §3.6): the
 * {@code DigestPrompt} system prompt + user message in, the model's raw JSON text out — or empty when the model is
 * unavailable, over budget or failed (the caller then stores fallback copy for every story). Implemented in
 * {@code feature/companion} on the cheap chat tier and tagged {@link #LLM_FEATURE}/{@link #LLM_OPERATION}
 * (payload-free in the audit log); with the companion off there is no bean. Lives here so penz never imports
 * companion.
 */
public interface PenzDigestLlm {

    String LLM_FEATURE = LlmCallContext.FEATURE_PENZ_DIGEST;
    String LLM_OPERATION = "narrate";

    Optional<String> narrate(String systemPrompt, String userMessage);
}
