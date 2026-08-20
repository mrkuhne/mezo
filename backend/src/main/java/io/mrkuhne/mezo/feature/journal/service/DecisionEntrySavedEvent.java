package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/**
 * Published after a decision is created or reviewed (bd mezo-b3pp.4). AFTER_COMMIT payload for
 * the companion embed listener: (re-)embeds the decision text — plus the outcome once reviewed —
 * into {@code memory_embedding(kind=decision)}.
 *
 * <p>No {@code userId} field, for the same reason as {@link JournalEntrySavedEvent}: mezo is
 * single-user and the listener re-reads the row by id anyway.
 */
public record DecisionEntrySavedEvent(UUID decisionId) {
}
