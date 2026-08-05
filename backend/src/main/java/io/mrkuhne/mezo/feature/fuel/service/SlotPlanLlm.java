package io.mrkuhne.mezo.feature.fuel.service;

/**
 * Consumer-owned LLM port (ADR 0012): fuel owns the interface, companion provides the adapter,
 * so feature/fuel never imports feature/companion. Used ONLY by the gated "judge my split"
 * slot-plan evaluate endpoint (mezo-7102) — a stateless, auth-gated-only call, nothing persisted.
 */
public interface SlotPlanLlm {
    /** One-shot completion on the cheap chat tier. */
    String complete(String systemPrompt, String userMessage);
}
