package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/** What capacity needs from the season (consumer-owned port; season never imports capacity). */
public interface CapacitySeasonPort {

    /** The active season's frame: its first day and its length in weeks. */
    record SeasonFrame(LocalDate startDate, int weeks) {
    }

    /** The owner's one active season, empty when there is none. */
    Optional<SeasonFrame> active(UUID owner);
}
