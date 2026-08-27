package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@code PatternService.decide} whenever a pattern lands in a status that is NOT
 * confirmed (bd mezo-b3pp.31) — the mirror of {@link PatternConfirmedEvent}. Fires on EVERY such
 * decide, not only on a transition out of confirmed: the consumer re-reads the pattern's status
 * anyway, so a pattern that was never confirmed simply has no node to retract and the handler is
 * a no-op. Keeping the publish rule that simple is what keeps {@code decide} free of any
 * knowledge about the graph.
 */
public record PatternRetractedEvent(UUID userId, UUID patternId) {
}
