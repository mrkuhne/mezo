package io.mrkuhne.mezo.feature.llmlog.service;

/**
 * The provider's generation usage counters, kept RAW (mezo-2zyu).
 *
 * <p>Gemini reports {@code cached} as a SUBSET of {@code prompt} and {@code total} as its own
 * number — both are stored verbatim, never recomputed. Billing is where the subset is netted out
 * ({@code LlmLogWriter#applyCost}), so the row stays physically honest about what the provider said.
 *
 * <p>Every component is nullable: a provider that reports no usage block must not be faked as zero.
 */
public record TokenUsage(Integer prompt, Integer candidates, Integer thoughts, Integer cached, Integer total) {}
