package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamChatThreadEntity;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TeamChatThreadRepository extends JpaRepository<TeamChatThreadEntity, UUID> {

    /** Final review I2 (mezo-a9bo7.25): the per-user push-budget lock — a transaction-scoped
     *  advisory lock ({@code CompanionMessageRepository.lockForDelivery} idiom) that serializes one
     *  user's {@code TeamChatService.decidePush} calls, so parallel raises from one evaluation can
     *  never both read "nothing pushed today". Released on commit/rollback; a hash collision with
     *  another user only costs a brief wait. */
    @Query(value = "select pg_advisory_xact_lock(hashtext('team_chat_push:' || cast(:userId as text)))",
            nativeQuery = true)
    void lockPushBudget(@Param("userId") UUID userId);

    /** mezo-a9bo7.27: the ügy's status straight from the database, or empty when it is already
     *  pushed (or gone). A scalar query on purpose — {@code findById} would hand back the
     *  persistence context's copy loaded BEFORE the push-budget lock, blind to a racing decision. */
    @Query("select t.status from TeamChatThreadEntity t where t.id = :id and (t.pushed is null or t.pushed = false)")
    Optional<String> unpushedStatus(@Param("id") UUID id);

    /** mezo-a9bo7.27: flip {@code pushed} in the database without writing back the whole
     *  (pre-lock) entity copy; 1 when this call claimed the push. */
    @Modifying
    @Query("update TeamChatThreadEntity t set t.pushed = :pushed where t.id = :id")
    int setPushed(@Param("id") UUID id, @Param("pushed") boolean pushed);

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

    /** Task 11 catch-up (mezo-a9bo7.23): is there ALREADY a thread for this flag opened at/after
     *  {@code since} (any status)? — the "no thread opened at/after the raise" gate, so the sweep
     *  never double-opens a raise the listener actually handled. */
    boolean existsByCreatedByAndFlagKeyAndOpenedAtGreaterThanEqualAndDeletedFalse(
            UUID createdBy, String flagKey, Instant since);

    /** The chat's own "already used" notion for {@code InterventionService.pick}: a library entry
     *  counts as used if any ügy of this user carrying it was opened at/after {@code since}. */
    boolean existsByCreatedByAndAdviceKeyAndOpenedAtGreaterThanEqualAndDeletedFalse(
            UUID createdBy, String adviceKey, Instant since);

    /** Row-locked owner-scoped read for {@code TeamChatService.apply} — two concurrent taps on the
     *  same action serialize here, so the second sees the first's {@code applied} stamp. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TeamChatThreadEntity t where t.id = :id and t.createdBy = :owner and t.deleted = false")
    Optional<TeamChatThreadEntity> lockOwned(UUID id, UUID owner);

    /** S7 (mezo-d6ivw.7): the rule's OPEN ügy, row-locked — {@code TeamChatService.closeThread}'s
     *  read. The status predicate is re-evaluated after the lock wait (Postgres re-checks a
     *  {@code FOR UPDATE} row's WHERE against its newest version), so an ügy a reply-close or an
     *  answer closed meanwhile comes back EMPTY instead of being overwritten as DATA. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from TeamChatThreadEntity t where t.createdBy = :owner and t.flagKey = :flagKey"
            + " and t.status = 'OPEN' and t.deleted = false")
    Optional<TeamChatThreadEntity> lockOpenByFlag(UUID owner, String flagKey);

    /** Task 15 (mezo-a9bo7.25): every ügy the day touched — opened OR closed in {@code [from, to)} —
     *  for the evening edition's {@code team_chat_day} recap; oldest first. */
    @Query("""
            select t from TeamChatThreadEntity t
            where t.createdBy = :owner and t.deleted = false
              and ((t.openedAt >= :from and t.openedAt < :to) or (t.closedAt >= :from and t.closedAt < :to))
            order by t.openedAt asc""")
    List<TeamChatThreadEntity> touchedBetween(UUID owner, Instant from, Instant to);

    /** S7: is there already an EXCUSE/REVIEW offer for this exception opened since the window
     *  start — the "don't re-offer within the same window" gate. */
    Optional<TeamChatThreadEntity> findFirstByCreatedByAndExceptionIdAndOfferAndOpenedAtGreaterThanEqualAndDeletedFalse(
            UUID createdBy, UUID exceptionId, String offer, Instant since);

    /** S7: the REVIEW ügyek answered "Nem, figyelj rá" (STOP, closed with the STOP note) for these
     *  exceptions — a STOP-withdrawn exception is not an undo, so its source ügy shows no chip. */
    List<TeamChatThreadEntity> findByCreatedByAndExceptionIdInAndOfferAndCloseNoteAndDeletedFalse(
            UUID createdBy, Collection<UUID> exceptionIds, String offer, String closeNote);
}
