package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface TeamChatThreadRepository extends JpaRepository<TeamChatThreadEntity, UUID> {

    Optional<TeamChatThreadEntity> findFirstByCreatedByAndFlagKeyAndStatusAndDeletedFalse(
            UUID createdBy, String flagKey, String status);

    List<TeamChatThreadEntity> findByCreatedByAndStatusAndDeletedFalseOrderByOpenedAtAsc(
            UUID createdBy, String status);

    List<TeamChatThreadEntity> findByStatusAndOpenedAtBeforeAndDeletedFalse(String status, Instant before);

    List<TeamChatThreadEntity> findByCreatedByAndOpenedAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);

    /** This rule's episodes for {@code TeamChatContext.pastEpisodes} — oldest first, the current
     *  ügy filtered out by the caller (it is context for the line being written, not its own past). */
    List<TeamChatThreadEntity> findByCreatedByAndFlagKeyAndOpenedAtGreaterThanEqualAndDeletedFalseOrderByOpenedAtAsc(
            UUID createdBy, String flagKey, Instant since);

    /** The day's push count for {@code TeamChatReads} ({@code pushesToday}). */
    long countByCreatedByAndPushedTrueAndOpenedAtBetweenAndDeletedFalse(UUID createdBy, Instant from, Instant to);

    /** The flag keys of every ügy already pushed today — {@code TeamChatService.open}'s input to
     *  {@link io.mrkuhne.mezo.feature.character.service.chat.TeamChatPushPolicy#shouldPush}. */
    List<TeamChatThreadEntity> findByCreatedByAndPushedTrueAndOpenedAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);

    Optional<TeamChatThreadEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** The chat's own "already used" notion for {@code InterventionService.pick}: a library entry
     *  counts as used if any ügy of this user carrying it was opened at/after {@code since}. */
    boolean existsByCreatedByAndAdviceKeyAndOpenedAtGreaterThanEqualAndDeletedFalse(
            UUID createdBy, String adviceKey, Instant since);

    /** Row-locked owner-scoped read for {@code TeamChatService.apply} — two concurrent taps on the
     *  same action serialize here, so the second sees the first's {@code applied} stamp. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TeamChatThreadEntity t where t.id = :id and t.createdBy = :owner and t.deleted = false")
    Optional<TeamChatThreadEntity> lockOwned(UUID id, UUID owner);
}
