package io.mrkuhne.mezo.feature.recipe.service;

import java.util.List;

/**
 * Recipe-owned LLM port for „Ezt főztem" (ADR 0012, mezo-r36n9.63) — same shape as
 * {@link RecipeImportLlm}. The companion feature provides the adapter; recipe never imports
 * {@code feature.companion}. An absent bean (companion off) degrades the capture to a clean 503 via
 * ObjectProvider.
 */
public interface RecipeCookedLlm {

    /** An ephemeral inline image — bytes live only for the call, never stored. */
    record Image(byte[] bytes, String mimeType) {}

    /** One-shot multimodal completion on the cheap tier (the capture read). */
    String complete(String systemPrompt, String userMessage, List<Image> images);

    /** One-shot text completion on the cheap tier (the capture read without photos, the pantry pick). */
    String complete(String systemPrompt, String userMessage);
}
