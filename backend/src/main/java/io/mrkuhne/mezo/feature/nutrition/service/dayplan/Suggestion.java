package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.util.UUID;

/**
 * What Boop offers for one open window. An offer, never a verdict: {@code text} is a plain
 * Hungarian sentence and {@code reason} says in one clause why this one — no judgement, no
 * numbers the day did not already contain.
 *
 * <p>{@link Kind#INGREDIENTS} is the honest fallback of owner decision 16: with a small recipe
 * library a window whose rules nothing passes shows an ingredient-level tip, never an empty row.
 */
public record Suggestion(Kind kind, UUID recipeId, String text, String reason) {

    public enum Kind {
        RECIPE, INGREDIENTS
    }
}
