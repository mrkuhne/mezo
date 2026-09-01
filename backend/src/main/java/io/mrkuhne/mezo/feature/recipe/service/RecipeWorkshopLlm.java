package io.mrkuhne.mezo.feature.recipe.service;

/**
 * Recipe-owned LLM port for the Receptműhely turn (ADR 0012, mezo-92pb). The companion feature
 * provides the adapter; recipe never imports {@code feature.companion}. An absent bean
 * (companion off) degrades the endpoint to a clean 503 via ObjectProvider.
 */
public interface RecipeWorkshopLlm {

    String complete(String systemPrompt, String userMessage);
}
