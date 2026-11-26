package io.mrkuhne.mezo.feature.season.port;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Season-owned seam to the day-adjustment ledger (Boop B7 K3, mezo-r36n9.17): the gym sessions the owner moved to
 * another day of the same week, so the adherence judges a moved session once, on its new day. The capacity feature
 * supplies the adapter, so the season never imports capacity.
 */
public interface SeasonAdjustmentPort {

    /** A gym session re-dated from {@code from} to {@code to}. */
    record Move(LocalDate from, LocalDate to) {
    }

    /** The moves in effect touching {@code from..to} (either of their days inside the range). */
    List<Move> movedSessions(UUID owner, LocalDate from, LocalDate to);
}
