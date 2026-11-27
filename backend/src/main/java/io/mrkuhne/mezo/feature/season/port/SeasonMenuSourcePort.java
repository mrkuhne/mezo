package io.mrkuhne.mezo.feature.season.port;

import io.mrkuhne.mezo.feature.nutrition.service.SensitivityProfile;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.Macros4;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.RecipeCandidate;
import io.mrkuhne.mezo.feature.nutrition.service.dayplan.SlotKey;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * What the weekly menu and the shopping list read from the food side (Boop B6 Évad S3): each day's meal windows and
 * budgets (the Étel day plan's own), his recipes as the suggester sees them, his sensitivity profile and the
 * recipes' ingredient lines. Season-owned port, season-side adapter ({@code SeasonMenuSourceAdapter}).
 */
public interface SeasonMenuSourcePort {

    /** One meal window of a day (owner-zone minutes since midnight); {@code budget} null on a kímélő day. */
    record FrameWindow(SlotKey slot, int ordinal, String label, Macros4 budget, int atMin) {
    }

    /**
     * A day's frame: whether gym and/or sport is planned, the first sport's name and start (minutes; null without
     * sport), every sport window of the day in clock order (Boop Sport S1, mezo-r36n9.201) and its meal windows in
     * clock order.
     */
    record DayFrame(LocalDate date, boolean gym, boolean sport, String sportName, Integer sportStartMin,
                    List<SportWindow> sports, List<FrameWindow> windows) {

        /** One sport occurrence: its name (the sport kind) and its start in owner-zone minutes. */
        public record SportWindow(String name, int startMin) {
        }

        public DayFrame {
            sports = sports == null ? List.of() : List.copyOf(sports);
        }

        /** The single-sport shape: the first sport (if any) is the only one. */
        public DayFrame(LocalDate date, boolean gym, boolean sport, String sportName, Integer sportStartMin,
                        List<FrameWindow> windows) {
            this(date, gym, sport, sportName, sportStartMin,
                sportStartMin == null ? List.of() : List.of(new SportWindow(sportName, sportStartMin)), windows);
        }
    }

    /** One ingredient line of a recipe: {@code recipeServings} servings use {@code amount unit} of it. */
    record IngredientLine(UUID recipeId, String recipeName, int recipeServings, UUID catalogId, String name,
                          BigDecimal amount, String unit, String category) {
    }

    List<DayFrame> frames(UUID owner, LocalDate from, LocalDate to);

    /** Every recipe of his with a known category, per serving (no season filter). */
    List<RecipeCandidate> recipes(UUID owner);

    SensitivityProfile profile(UUID owner);

    List<IngredientLine> ingredients(UUID owner, Collection<UUID> recipeIds);
}
