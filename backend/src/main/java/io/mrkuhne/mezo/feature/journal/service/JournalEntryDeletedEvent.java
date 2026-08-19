package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/**
 * Published after a journal entry is soft-deleted (bd mezo-b3pp.1). AFTER_COMMIT payload for the
 * companion embed listener (Task 4): removes the entry's stale row from {@code memory_embedding}.
 *
 * <p>No {@code userId} field — see {@link JournalEntrySavedEvent}'s note: mezo is single-user, so
 * an owner id on this event would be carried but never checked.
 */
public record JournalEntryDeletedEvent(UUID entryId) {
}
