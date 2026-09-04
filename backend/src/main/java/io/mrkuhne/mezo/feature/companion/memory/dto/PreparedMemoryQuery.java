package io.mrkuhne.mezo.feature.companion.memory.dto;

import java.time.LocalDate;
import java.util.Optional;

/** Deterministic query analysis plus the optional standalone dense-search rewrite. */
public record PreparedMemoryQuery(
        QueryMode mode,
        String rawQuery,
        String denseQuery,
        Optional<LocalDate> from,
        Optional<LocalDate> to) {
}
