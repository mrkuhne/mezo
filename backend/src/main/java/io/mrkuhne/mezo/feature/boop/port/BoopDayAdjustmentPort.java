package io.mrkuhne.mezo.feature.boop.port;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Boop-owned seam to the day-adjustment ledger (Boop B7 K3, mezo-r36n9.17): the one-night bedtime the owner accepted.
 * The capacity feature supplies the adapter, so boop stays a leaf. (The session changes reach boop through train's
 * own ledger-aware reads.)
 */
public interface BoopDayAdjustmentPort {

    /** The accepted bedtime for the night starting on {@code night} (the evening's date); empty when none. */
    Optional<LocalTime> bedtime(UUID owner, LocalDate night);
}
