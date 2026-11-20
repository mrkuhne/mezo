package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import java.util.Optional;

/**
 * Port for the proposal narration (Boop Pénz L7, mezo-r36n9.105, build notes call 13): the {@code ProposalPrompt}
 * system prompt + user message in, the model's raw JSON text out — or empty when the model is unavailable, over
 * budget or failed (the caller then uses the fixed copy). Implemented in {@code feature/companion} on the cheap chat
 * tier and tagged {@link #LLM_FEATURE}/{@link #LLM_OPERATION} (payload-free in the audit log: the prompt carries his
 * money figures); with the companion off there is no bean. Lives here so penz never imports companion.
 */
public interface PenzProposalLlm {

    String LLM_FEATURE = LlmCallContext.FEATURE_PENZ_PROPOSAL;
    String LLM_OPERATION = "narrate";

    Optional<String> narrate(String systemPrompt, String userMessage);
}
