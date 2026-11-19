package io.mrkuhne.mezo.feature.penz.service;

/**
 * Port for reading one bank SMS into JSON (Boop Pénz L4, mezo-r36n9.102, spec §9 / ADR 0012) — the
 * {@code DayCloseLlm} shape. Implemented in {@code feature/companion} on the cheap chat tier (the budget gate and
 * the model router live behind {@code CompanionLlm}); with the companion off there is no bean and a money-looking
 * SMS is stored {@code failed/llm_error}. Lives here so penz never imports companion.
 */
public interface PenzSmsLlm {

    String complete(String systemPrompt, String userMessage);
}
