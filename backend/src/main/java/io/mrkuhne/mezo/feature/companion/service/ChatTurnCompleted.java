package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@link ChatService} after the assistant row of a turn is persisted (sync AND
 * streamed path). Consumed AFTER_COMMIT by the async {@code FactExtractionListener} (V1.2) —
 * in rolled-back test transactions the event never fires, by design.
 */
public record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent, String assistantContent) {
}
