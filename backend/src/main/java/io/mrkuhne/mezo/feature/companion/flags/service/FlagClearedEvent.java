package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.Instant;
import java.util.UUID;

/**
 * Published by {@link FlagTraceWriter} whenever a rule's trace row changes TO {@code clear} —
 * a resolve, from any previous state (spec csapat-elo-beszelgetes, Task 2). The trace writer does
 * not know or care whether an ügy was open for this {@code flagKey}; that decision belongs to the
 * chat side listening for this event. Published inside the same transaction as the trace row, so
 * an AFTER_COMMIT listener only ever reacts to a resolve that persisted.
 */
public record FlagClearedEvent(UUID userId, String flagKey, FlagVerdict.ClearEvidence evidence, Instant at) {
}
