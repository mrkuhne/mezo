package io.mrkuhne.mezo.feature.journal.entity;

import java.time.Instant;

/**
 * Typed jsonb payload for {@code decision_entry.context_snapshot} (bd mezo-b3pp.4, spec §5.4):
 * the rendered {@code ContextSnapshotAssembler} text plus the instant it was frozen.
 *
 * <p>{@code snapshotText} is empty — never fabricated — when the companion switch is off and the
 * assembler bean does not exist (IDENT-3: honest degraded state).
 */
public record DecisionContextEnvelope(String snapshotText, Instant capturedAt) {
}
