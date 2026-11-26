package io.mrkuhne.mezo.feature.meal.port;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Meal-owned seam to the day-adjustment ledger (Boop B7 K3, mezo-r36n9.17): energy the owner accepted to move
 * between the day's meal slots. The capacity feature supplies the adapter, so meal never imports capacity.
 */
public interface MealDayAdjustmentPort {

    /**
     * Signed kcal deltas per slot ({@code breakfast | lunch | dinner | snack}) summed over the day's changes in
     * effect; they sum to zero (the day total never changes). Empty when nothing moved.
     */
    Map<String, Integer> slotSplit(UUID owner, LocalDate date);

    /** The accepted bedtime for the night starting on {@code night}; empty when none. Moves the day plan's last window
     *  and its bedtime gate for that day. */
    Optional<LocalTime> bedtime(UUID owner, LocalDate night);
}
