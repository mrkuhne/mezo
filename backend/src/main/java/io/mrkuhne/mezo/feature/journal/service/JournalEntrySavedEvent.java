package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/**
 * Published after a journal entry is created or updated (bd mezo-b3pp.1). AFTER_COMMIT payload
 * for the companion embed listener (Task 4): re-embeds the entry's current text into
 * {@code memory_embedding}.
 */
public record JournalEntrySavedEvent(UUID userId, UUID entryId) {
}
