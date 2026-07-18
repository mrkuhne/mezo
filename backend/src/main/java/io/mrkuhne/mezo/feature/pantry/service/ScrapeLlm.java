package io.mrkuhne.mezo.feature.pantry.service;

/**
 * Consumer-owned LLM port for the URL-scrape extraction (mezo-8vum). Pantry defines the seam it
 * needs; the companion feature provides the adapter ({@code PantryScrapeLlmAdapter}) that delegates
 * to the real {@code CompanionLlm} port. Owning the interface HERE keeps the only cross-feature
 * dependency pointing companion → pantry (never pantry → companion), so the ArchUnit feature-slice
 * cycle check stays closed even though the scrape path is LLM-backed.
 *
 * <p>The single method mirrors the {@code CompanionLlm} two-string cheap-tier overload; the
 * underlying provider seam is ADR 0008.
 */
public interface ScrapeLlm {

    /** One-shot completion on the cheap chat tier. */
    String complete(String systemPrompt, String userMessage);
}
