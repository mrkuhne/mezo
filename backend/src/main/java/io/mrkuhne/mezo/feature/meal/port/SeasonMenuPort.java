package io.mrkuhne.mezo.feature.meal.port;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The active season's weekly menu as the Étel day plan reads it (Boop B6 Évad S3, spec §5.7) — consumer-owned port
 * (ADR 0012); the season feature supplies the adapter.
 */
public interface SeasonMenuPort {

    /**
     * The recipes the active season allows — the day plan offers only these. Empty means "no filter": no active season,
     * or a season that allows no recipe yet (it would otherwise never offer a recipe at all).
     */
    Set<UUID> allowedRecipes(UUID owner);

    /** The approved menu's meals on that date — each is that window's suggestion. Empty without an approved week. */
    List<MenuMeal> approvedMeals(UUID owner, LocalDate date);

    /**
     * One approved meal: the day's {@code ordinal}-th window of {@code slot} (wire value), a recipe scaled to it, or an
     * ingredient tip ({@code recipeId} null, {@code name} the tip).
     */
    record MenuMeal(String slot, int ordinal, UUID recipeId, String name, int kcal, Integer proteinG) {
    }
}
