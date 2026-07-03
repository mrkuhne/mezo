package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@link ChatService} after the assistant row of a turn is persisted (sync AND
 * streamed path). Consumed AFTER_COMMIT by the async {@code FactExtractionListener} (V1.2) and
 * {@code TurnEmbeddingListener} (V2.2) — in rolled-back test transactions the event never fires,
 * by design. {@code assistantMessageId} is the turn's stable ref for the embedding row
 * (uq_memory_embedding_kind_ref_id).
 */
public record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent,
                                UUID assistantMessageId, String assistantContent) {
}
