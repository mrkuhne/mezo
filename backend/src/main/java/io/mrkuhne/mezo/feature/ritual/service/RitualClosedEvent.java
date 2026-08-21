package io.mrkuhne.mezo.feature.ritual.service;

import java.util.UUID;

/**
 * Published AFTER_COMMIT when a Napzárás day is closed (bd mezo-b3pp.2, spec §5.2) — and again
 * when an already-closed day's reflection is edited, so the vector never goes stale. The
 * companion's {@code ReflectionEmbeddingListener} consumes it and embeds the day's prose.
 *
 * <p>No {@code userId} field — mezo is single-user and the listener re-reads the row by id
 * (the {@code JournalEntrySavedEvent} precedent).
 */
public record RitualClosedEvent(UUID ritualDayId) {
}
