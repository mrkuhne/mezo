package io.mrkuhne.mezo.feature.recipe.service;

import java.util.List;

/**
 * Recipe-owned LLM port for the recipe import (ADR 0012, Boop B4). The companion feature provides the
 * adapter; recipe never imports {@code feature.companion}. An absent bean (companion off) degrades the
 * AI reads to a clean 503 via ObjectProvider.
 */
public interface RecipeImportLlm {

    /** An ephemeral inline image — bytes live only for the call, never stored. */
    record Image(byte[] bytes, String mimeType) {}

    /** One-shot completion on the cheap tier. */
    String complete(String systemPrompt, String userMessage);

    /** One-shot multimodal completion on the cheap tier. */
    String complete(String systemPrompt, String userMessage, List<Image> images);
}
