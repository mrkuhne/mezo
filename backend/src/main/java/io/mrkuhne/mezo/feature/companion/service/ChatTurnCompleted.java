package io.mrkuhne.mezo.feature.companion.service;

import java.util.UUID;

/**
 * Published by {@link ChatService} after the assistant row of a turn is persisted (sync AND
 * streamed path). Consumed AFTER_COMMIT by the async {@code FactExtractionListener} (V1.2) and
 * {@code TurnEmbeddingListener} (V2.2) — in rolled-back test transactions the event never fires,
 * by design. {@code assistantMessageId} is the turn's stable ref for the embedding row
 * (uq_memory_embedding_kind_ref_id). {@code extractionBlocked} (S8, mezo-d6ivw.12): the user
 * message was a forget request — the fact and person-fact listeners skip it entirely.
 * {@code learningPaused} (mezo-rrjxe): the turn was made while "Most ne tanulj" was on — every
 * post-turn learner skips it. Decided once, at publish time, from the USER message's own instant;
 * a later resume does not un-pause this turn.
 */
public record ChatTurnCompleted(UUID userId, UUID userMessageId, String userContent,
                                UUID assistantMessageId, String assistantContent, boolean extractionBlocked,
                                boolean learningPaused) {
}
