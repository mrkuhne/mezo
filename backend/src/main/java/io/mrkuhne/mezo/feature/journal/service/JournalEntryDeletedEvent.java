package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/**
 * Published after a journal entry is soft-deleted (bd mezo-b3pp.1). AFTER_COMMIT payload for the
 * companion embed listener (Task 4): removes the entry's stale row from {@code memory_embedding}.
 */
public record JournalEntryDeletedEvent(UUID userId, UUID entryId) {
}
