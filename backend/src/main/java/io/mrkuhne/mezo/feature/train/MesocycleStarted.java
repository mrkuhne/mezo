package io.mrkuhne.mezo.feature.train;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@code TrainService.stampRun} on every stamp (template start, re-run, the season's own block start —
 * active or planned) and by {@code TrainService.activateMesocycle} on a REAL activation (a planned block reaching its
 * day through {@code PlannedBlockStarter}, or a manual activate), in the writing transaction. Consumed AFTER_COMMIT by
 * the season's {@code SeasonBlockLinkListener} (mezo-r36n9.113): the new block becomes the season's block. In a
 * rolled-back test transaction it never fires, by design.
 */
public record MesocycleStarted(UUID userId, UUID mesocycleId, LocalDate startDate) {
}
