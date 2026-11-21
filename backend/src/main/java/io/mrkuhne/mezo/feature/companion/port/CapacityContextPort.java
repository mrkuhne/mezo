package io.mrkuhne.mezo.feature.companion.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The owner's day capacity (Boop B7 K2) as the companion's context and its {@code get_capacity} tool read it —
 * consumer-owned port (ADR 0012); the capacity feature supplies the adapter, so companion never imports capacity.
 * Both reads are stored-only (they never start the scoring model) and never throw.
 */
public interface CapacityContextPort {

    /** Today's verdict as one {@code "[Kapacitás] "} line; {@code ""} without data or when capacity is off. */
    String render(UUID owner, LocalDate today);

    /**
     * The seven day verdicts of the ISO week named by {@code week} ({@code "2026-W47"} or any date in it), Monday
     * first, as {@code "[Kapacitás] "} lines; {@code ""} without data, when capacity is off or {@code week} is invalid.
     */
    String week(UUID owner, String week);
}
