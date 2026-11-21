package io.mrkuhne.mezo.feature.season.port;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** The food side of a day as the Étel room serves it (consumer-owned port; adapter season-side). */
public interface SeasonMealPort {

    /**
     * One day, read from the same fuel week the Étel Hét tab renders.
     *
     * @param kcal       consumed kcal rounded; null when nothing was logged (consumed kcal 0)
     * @param targetKcal the day's served target (DayTargetProjector), rounded
     * @param kimelo     a kímélő-mód day — the fuel week carries a fuel mode for it
     */
    record FoodDay(LocalDate date, Integer kcal, int targetKcal, Integer proteinG, int targetProteinG,
                   boolean kimelo) {
    }

    /** Every day of {@code from..to}, oldest first. */
    List<FoodDay> foodDays(UUID owner, LocalDate from, LocalDate to);
}
