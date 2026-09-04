package io.mrkuhne.mezo.feature.goal.engine.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): the adaptive review's "did the intake match the plan?" context.
 * Implemented in feature/meal off the FuelDayService week rollup — the goal engine never reads
 * meal tables directly.
 */
public interface IntakeAdherencePort {

    /** Averages over logged days only (a day counts as logged when any meal kcal was recorded). */
    record IntakeAdherence(int loggedDays, int avgIntakeKcal, int avgTargetKcal) {}

    IntakeAdherence weekAdherence(UUID userId, LocalDate weekStart);
}
