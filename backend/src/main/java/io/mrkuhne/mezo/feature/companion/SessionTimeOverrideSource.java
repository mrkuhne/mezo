package io.mrkuhne.mezo.feature.companion;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Read seam for the owner moving the day's planned gym session to another time in Boop (Boop B3,
 * mezo-r36n9.13). The override lives in {@code feature.boop}, which companion must not import (boop →
 * companion exists; the ArchUnit cycle rule), so boop implements this port and companion reads it through
 * an {@code ObjectProvider} — absent bean = no override.
 */
public interface SessionTimeOverrideSource {

    /** The time the owner moved {@code date}'s planned session to, if he did. */
    Optional<LocalTime> movedTime(UUID owner, LocalDate date);
}
