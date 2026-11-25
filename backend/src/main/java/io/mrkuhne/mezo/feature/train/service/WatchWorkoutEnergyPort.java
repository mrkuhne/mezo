package io.mrkuhne.mezo.feature.train.service;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Consumer-owned port (mezo-r36n9.170): what the owner's watch measured for one logged gym session.
 * Implemented by the {@code wearable} slice, which already depends on train — so train asks without
 * importing wearable and no slice cycle is added.
 */
public interface WatchWorkoutEnergyPort {

    /**
     * The kcal of the Health strength workout that matches {@code session}, or empty when no
     * matched workout carries a positive kcal.
     *
     * @param date the session's local date — Health workouts are looked up on that day only
     */
    Optional<Integer> watchKcal(UUID userId, LocalDate date, LoggedSession session);
}
