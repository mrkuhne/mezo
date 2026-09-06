package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Companion-owned read seam (ADR 0012, the {@link NudgeSendPort} precedent) for the ONE coaching
 * card a day delivered. The observer needs it to answer "which rule won" — spec 2026-09-05 §4.3:
 * the card outcome is DERIVED at read time by comparing the day's card against the RAISED+LOGGED
 * trace rows, never stored, because the winner is decided after the trace row is already written
 * and the table is append-only.
 */
public interface DailyCardPort {

    /**
     * @param adviceKey  the card's SEVERITY key — a {@link FlagKey} for a flag-sourced card, or a
     *                   setup-check key for a setup-sourced one, which matches none of the flags.
     * @param deliveredAt when the card was written, i.e. the instant the ranking actually chose it.
     *                   The observer needs it to answer "was this rule's state PART of that
     *                   decision" — a trace row written after this instant says nothing about the
     *                   card, in either direction (bd mezo-y43v).
     */
    record DeliveredCard(UUID cardId, String adviceKey, Instant deliveredAt) {
    }

    /** The live {@code advice} card for that day, if one was delivered. */
    Optional<DeliveredCard> forDay(UUID userId, LocalDate date);
}
