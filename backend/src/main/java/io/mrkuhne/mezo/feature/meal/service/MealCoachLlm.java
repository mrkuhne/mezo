package io.mrkuhne.mezo.feature.meal.service;

/**
 * Meal-owned LLM port (ADR 0012, mezo-mr4n): the coach layer's only LLM dependency. The companion
 * feature provides the adapter (cheap tier), so meal never imports {@code feature.companion} and
 * the feature graph stays acyclic. An absent bean (companion off) means no verdicts are produced
 * and the deterministic envelope is served un-enriched — never an error.
 */
public interface MealCoachLlm {

    String complete(String systemPrompt, String userMessage);
}
