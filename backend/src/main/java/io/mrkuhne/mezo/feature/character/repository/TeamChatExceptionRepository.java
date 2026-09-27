package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatExceptionEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamChatExceptionRepository extends JpaRepository<TeamChatExceptionEntity, UUID> {

    /** S7 (mezo-d6ivw.7): serializes one user's exception/hit writes (a transaction-scoped
     *  advisory lock, the {@code TeamChatThreadRepository.lockPushBudget} idiom) — the reply
     *  commit reads "is this tag known / hit today?" and then writes, and the unique
     *  (user, rule, tag) and (exception, day) indexes must never fail that transaction. Take it
     *  AFTER any ügy row lock. */
    @Query(value = "select pg_advisory_xact_lock(hashtext('team_chat_exception:' || cast(:userId as text)))",
            nativeQuery = true)
    void lockUserExceptions(@Param("userId") UUID userId);

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
