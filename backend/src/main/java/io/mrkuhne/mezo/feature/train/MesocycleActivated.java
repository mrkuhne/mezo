package io.mrkuhne.mezo.feature.train;

import java.util.UUID;

/**
 * Published by {@code TrainService.activateMesocycle} on the REAL activation branch only (never
 * on an idempotent re-activate). Consumed AFTER_COMMIT by the goal's diet-phase suggestion
 * listener (Diet Plan slice 4) — in a rolled-back test transaction the event never fires, by
 * design (mirrors {@link MesocycleClosed}).
 */
public record MesocycleActivated(UUID userId, UUID mesocycleId) {
}
