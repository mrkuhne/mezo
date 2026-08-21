package io.mrkuhne.mezo.feature.ritual.service;

import java.util.UUID;

/**
 * Signals that a Napzárás day's prose needs (re-)embedding (bd mezo-b3pp.2, spec §5.2).
 *
 * <p><b>Published INSIDE the writing transaction</b> — a plain {@code publishEvent} from
 * {@code RitualService}, not an AFTER_COMMIT hand-off. The commit boundary is therefore the
 * CONSUMER's responsibility: embed off a {@code @TransactionalEventListener(phase = AFTER_COMMIT)},
 * never a plain {@code @EventListener}, or the listener runs inside the writing transaction and
 * may embed prose that then rolls back (the {@code JournalEntrySavedEvent} listener's shape).
 *
 * <p>Published from exactly TWO sites, both in {@code RitualService}: the single {@code closed_at}
 * stamp branch in {@code close} (once per FIRST close — a repeat close skips the branch), and
 * {@code saveReflection} when an already-closed day's reflection is edited, so the vector cannot
 * go stale. {@code ReflectionEmbeddingListener} consumes it.
 *
 * <p>No {@code userId} field — mezo is single-user and the listener re-reads the row by id
 * (the {@code JournalEntrySavedEvent} precedent).
 */
public record RitualClosedEvent(UUID ritualDayId) {
}
