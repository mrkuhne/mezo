package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@code PatternService.decide} inside the transaction whenever a pattern lands in
 * {@code confirmed}; an AFTER_COMMIT listener therefore sees it only once the decision is durable.
 * Consumed by the W2.2 {@code GraphPromotionListener} (graph switch off ⇒ nobody listens).
 */
public record PatternConfirmedEvent(UUID userId, UUID patternId) {
}
