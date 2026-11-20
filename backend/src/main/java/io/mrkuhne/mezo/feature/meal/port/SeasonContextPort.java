package io.mrkuhne.mezo.feature.meal.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The owner's season rules for the meal coach (Boop B6 Évad: allowed recipes, NOVA rule, day targets) —
 * consumer-owned port (ADR 0012); the season feature supplies the adapter.
 */
public interface SeasonContextPort {

    /** The season's rules as lines starting {@code "[Évad] "}; {@code ""} without an active season. */
    String render(UUID owner, LocalDate today);
}
