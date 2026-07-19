package io.mrkuhne.mezo.feature.recipe.service;

/**
 * Recipe-owned LLM port (ADR 0012, mezo-bw3y): the template-breakdown prose generator's only LLM
 * dependency. The companion feature provides the adapter (cheap tier), so recipe never imports
 * {@code feature.companion}. An absent bean (companion off) means the prose layer is skipped and
 * the deterministic envelope is served un-enriched — never an error.
 */
public interface RecipeBreakdownLlm {

    String complete(String systemPrompt, String userMessage);
}
