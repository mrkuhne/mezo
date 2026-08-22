package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@code FactCandidateService} right after an accept/refine promotes a candidate into
 * a {@code knowledge_fact}. Consumed by the W2.2 {@code GraphPromotionListener} (PREFERENCE node).
 */
public record KnowledgeFactPromotedEvent(UUID userId, UUID factId) {
}
