package io.mrkuhne.mezo.feature.train;

import java.util.UUID;

/**
 * Published by {@code TrainService.closeMesocycle} (on the REAL close only — never on an
 * idempotent re-close nor the fill-if-null self-eval branch) and by
 * {@code MesocycleReportService.regenerate} (every accepted call — the report's re-generation
 * trigger), right after the {@code mesocycle_report} row is persisted, in the same transaction.
 * Consumed AFTER_COMMIT by the companion's async AI-review generator (mezo-meyc.3, S3 task 15) —
 * in a rolled-back test transaction the event never fires, by design (mirrors
 * {@code ChatTurnCompleted}).
 */
public record MesocycleClosed(UUID userId, UUID mesocycleId) {
}
