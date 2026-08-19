package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/**
 * Published after a journal entry is created or updated (bd mezo-b3pp.1). AFTER_COMMIT payload
 * for the companion embed listener (Task 4): re-embeds the entry's current text into
 * {@code memory_embedding}.
 *
 * <p>No {@code userId} field: mezo is single-user (CLAUDE.md — {@code created_by} scoping exists
 * for schema/query shape, not multi-tenant isolation), and the listener re-reads the entry by id
 * from the DB anyway, so an owner id here would be carried but never meaningfully checked. Do not
 * add it back without a real multi-user need.
 */
public record JournalEntrySavedEvent(UUID entryId) {
}
