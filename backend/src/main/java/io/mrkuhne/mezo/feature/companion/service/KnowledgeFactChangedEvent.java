package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@code KnowledgeFactService.update} on every partial update (mezo-b3pp.30).
 * Distinct from {@link KnowledgeFactPromotedEvent}, which marks a candidate BECOMING a fact: this
 * one says "an existing fact changed, and the change may have flipped whether it belongs in the
 * companion's prompt at all" — the consumer re-derives the answer, so publishing on every update
 * (text, category or the {@code includeInPrompt} toggle) keeps the publisher free of that
 * decision, and incidentally keeps a renamed fact's graph node title fresh.
 */
public record KnowledgeFactChangedEvent(UUID userId, UUID factId) {
}
