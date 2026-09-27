package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamChatExceptionRepository extends JpaRepository<TeamChatExceptionEntity, UUID> {

    List<TeamChatExceptionEntity> findByCreatedByAndFlagKeyAndActiveTrueAndDeletedFalseOrderByCreatedAtAsc(
            UUID createdBy, String flagKey);

    Optional<TeamChatExceptionEntity> findFirstByCreatedByAndFlagKeyAndNormalizedTagAndDeletedFalse(
            UUID createdBy, String flagKey, String normalizedTag);

    Optional<TeamChatExceptionEntity> findFirstBySourceThreadIdAndCreatedByAndDeletedFalse(
            UUID sourceThreadId, UUID createdBy);

    Optional<TeamChatExceptionEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Task 2 input: exceptions captured off any of a batch of source threads (S7 reply write-back). */
    List<TeamChatExceptionEntity> findBySourceThreadIdInAndCreatedByAndDeletedFalse(
            Collection<UUID> sourceThreadIds, UUID createdBy);

    /** Task 2 input: a batch of exceptions by id, owner-scoped. */
    List<TeamChatExceptionEntity> findByIdInAndCreatedByAndDeletedFalse(Collection<UUID> ids, UUID createdBy);
}
