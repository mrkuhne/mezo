package io.mrkuhne.mezo.feature.boop.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The owner's season rules for the Boop morning brief (Boop B6 Évad) — consumer-owned port (ADR 0012); the season
 * feature supplies the adapter.
 */
public interface SeasonContextPort {

    /** The season's rules as lines starting {@code "[Évad] "}; {@code ""} without an active season. */
    String render(UUID owner, LocalDate today);
}
