package io.mrkuhne.mezo.feature.journal.service;

import java.util.UUID;

/** Published AFTER a gratitude entry is saved; carries only the id (listener re-reads post-commit). */
public record GratitudeEntrySavedEvent(UUID entryId) {}
