package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.UUID;

/** The food side of a day as the Étel room serves it (consumer-owned port; meal never imports capacity). */
public interface CapacityMealPort {

    /** {@code loggedKcal} is null when nothing was logged that day; {@code targetKcal} is the day's served target. */
    record FuelDay(LocalDate date, Integer loggedKcal, int targetKcal) {
    }

    FuelDay fuelDay(UUID owner, LocalDate date);
}
