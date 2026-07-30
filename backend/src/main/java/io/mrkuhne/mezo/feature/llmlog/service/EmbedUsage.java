package io.mrkuhne.mezo.feature.llmlog.service;

/**
 * Embedding-call usage (mezo-2zyu) — embeddings are billed per CHARACTER, not per token, so this is
 * a separate block from {@link TokenUsage} rather than a reinterpretation of it.
 *
 * @param inputCount    how many texts were embedded in the call (batch size)
 * @param dimensions    the produced vector width
 * @param billableChars total characters sent — the cost basis
 */
public record EmbedUsage(Integer inputCount, Integer dimensions, Integer billableChars) {}
