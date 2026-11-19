package io.mrkuhne.mezo.feature.pantry.service;

/**
 * Consumer-owned LLM port for the quick-add's nutrition estimate (mezo-r36n9.63, ADR 0012). Pantry
 * defines the seam; the companion feature provides the adapter ({@code PantryEstimateLlmAdapter}), so
 * the only cross-feature dependency keeps pointing companion -> pantry. An absent bean (companion off)
 * degrades the estimate step to a clean 503 — binding an existing shared food still works.
 */
public interface PantryEstimateLlm {

    /** One-shot text completion on the cheap tier. */
    String complete(String systemPrompt, String userMessage);
}
