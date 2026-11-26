package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.UUID;

/** The food side of a day as the Étel room serves it (consumer-owned port; meal never imports capacity). */
public interface CapacityMealPort {

    /**
     * {@code loggedKcal} is null when nothing was logged that day; {@code targetKcal} is the day's served target;
     * {@code pendingMovementKcal} is the display-only expected extra of the day's still-unlogged sessions (null when
     * nothing is pending or the day has no energy equation) — it joins the target only when the session is logged.
     */
    record FuelDay(LocalDate date, Integer loggedKcal, int targetKcal, Integer pendingMovementKcal) {
        public FuelDay(LocalDate date, Integer loggedKcal, int targetKcal) {
            this(date, loggedKcal, targetKcal, null);
        }
    }

    FuelDay fuelDay(UUID owner, LocalDate date);
}
