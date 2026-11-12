package io.mrkuhne.mezo.feature.dayclose.service;

import java.time.LocalDate;
import java.util.UUID;

/** Published inside the close's transaction on every successful {@code PUT /api/day-close/{date}} (Boop B3,
 *  mezo-r36n9.13) — for B8 and any later reader; nothing listens yet. */
public record DayClosedEvent(UUID owner, LocalDate date) {
}
