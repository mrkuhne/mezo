package io.mrkuhne.mezo.feature.companion.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The owner's season (Boop B6 Évad) as the companion's context and its {@code get_season} tool read it —
 * consumer-owned port (ADR 0012); the season feature supplies the adapter, so companion never reads season tables.
 */
public interface SeasonContextPort {

    /** The season's rules as lines starting {@code "[Évad] "}; {@code ""} without an active season. */
    String render(UUID owner, LocalDate today);

    /** Where the season stands (week, status, last week's adherence, insights) as {@code "[Évad] "} lines; {@code ""} without one. */
    String overview(UUID owner, LocalDate today);

    /**
     * This and next week's menu of the season (Évad S3) as {@code "[Évad] "} lines — the days, each meal's window, name
     * and kcal, and whether the week is approved; {@code ""} without a season or a menu.
     */
    String menu(UUID owner, LocalDate today);
}
