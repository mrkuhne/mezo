package io.mrkuhne.mezo.feature.fuel.service;

/**
 * Consumer-owned LLM port (ADR 0012): fuel owns the interface, companion provides the adapter,
 * so feature/fuel never imports feature/companion. Used ONLY as the placement fallback for
 * supplements the deterministic rule table does not recognize (mezo-vx9v).
 */
public interface StackPlacementLlm {
    /** One-shot completion on the cheap chat tier. */
    String complete(String systemPrompt, String userMessage);
}
