package io.mrkuhne.mezo.feature.train;

import java.time.LocalDate;
import java.util.UUID;

/**
 * A block that actually starts running (mezo-r36n9.113 — the season always shows the running block). Published by
 * {@code TrainService.stampRun} for an ACTIVE stamp only (template start, re-run, the season's own block start) and by
 * {@code TrainService.activateMesocycle} on a REAL activation (a planned block reaching its day through
 * {@code PlannedBlockStarter}, or a manual activate), in the writing transaction. {@code startDate} = the day it runs
 * from: its start date, or today when that lies in the past (a re-activated old run). Consumed AFTER_COMMIT by the
 * season's {@code SeasonBlockLinkListener}: the block becomes the season's block. In a rolled-back test transaction
 * it never fires, by design.
 */
public record MesocycleStarted(UUID userId, UUID mesocycleId, LocalDate startDate) {
}
