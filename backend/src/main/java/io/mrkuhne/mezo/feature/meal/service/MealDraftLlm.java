package io.mrkuhne.mezo.feature.meal.service;

/**
 * Meal-owned LLM seam for the AI meal-draft extraction (ADR 0012 consumer-owned port).
 * The companion feature provides the adapter; meal NEVER imports feature.companion, so the
 * only cross-feature edge runs companion -> meal (same direction as the existing transitive
 * dependency) and the ArchUnit feature-slice cycle rule stays green.
 */
public interface MealDraftLlm {

    /** Cheap-tier text-only completion. */
    String complete(String systemPrompt, String userMessage);

    /** Cheap-tier multimodal completion with ONE ephemeral inline image. */
    String complete(String systemPrompt, String userMessage, byte[] imageBytes, String mimeType);
}
