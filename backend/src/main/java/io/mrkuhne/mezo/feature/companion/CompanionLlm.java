package io.mrkuhne.mezo.feature.companion;

import reactor.core.publisher.Flux;

/**
 * The single seam between the companion and any LLM (ADR 0008). Everything above this
 * interface is deterministic and provider-agnostic; everything below it is one adapter
 * ({@code GeminiCompanionLlm} for real traffic, {@code FakeCompanionLlm} under the
 * {@code companion-fake} profile so integration tests never touch the network).
 *
 * <p>V0.1 shape — a system prompt + one user message, sync and streamed. Later slices
 * evolve it (V0.2 history windowing, V0.5 tool calling) without leaking provider types.
 */
public interface CompanionLlm {

    /** One-shot completion on the cheap chat tier. */
    String complete(String systemPrompt, String userMessage);

    /** Streamed completion (token/chunk deltas) on the cheap chat tier. */
    Flux<String> stream(String systemPrompt, String userMessage);
}
