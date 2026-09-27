package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatLineEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamChatLineRepository extends JpaRepository<TeamChatLineEntity, UUID> {

    List<TeamChatLineEntity> findByCreatedByAndOccurredAtBetweenAndDeletedFalseOrderByOccurredAtAsc(
            UUID createdBy, Instant from, Instant to);

    long countByCreatedByAndCharacterIsNotNullAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);

    List<TeamChatLineEntity> findByIdInAndCreatedBy(Collection<UUID> ids, UUID createdBy);

    boolean existsByThreadIdAndKind(UUID threadId, String kind);

    /** A past episode's lines for {@code TeamChatContext} reactions — the feedback lookup keys off
     *  their ids ({@code message_feedback.artifact_id}). */
    List<TeamChatLineEntity> findByThreadIdAndDeletedFalse(UUID threadId);

    /** S7: the day's REPLY (or any non-USER character) lines for {@code TeamChatBudget}. */
    long countByCreatedByAndCharacterIsNotNullAndKindNotAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, String kind, Instant from, Instant to);

    /** S7: this thread's voiced (LLM) lines of a kind today — the per-ügy voiced-reply cap. */
    long countByThreadIdAndKindAndVoicedTrueAndOccurredAtBetweenAndDeletedFalse(
            UUID threadId, String kind, Instant from, Instant to);

    /** S7: all lines of a kind for a user today — the user's own REPLY daily cap. */
    long countByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, String kind, Instant from, Instant to);

    /** S7: a thread's full transcript, oldest first. */
    List<TeamChatLineEntity> findByThreadIdAndDeletedFalseOrderByOccurredAtAsc(UUID threadId);

    /** S7: a user's lines of a kind in a window — the evening recap's REPLY pull. */
    List<TeamChatLineEntity> findByCreatedByAndKindAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, String kind, Instant from, Instant to);
}
