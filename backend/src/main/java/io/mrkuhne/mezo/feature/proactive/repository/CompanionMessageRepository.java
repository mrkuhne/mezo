package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanionMessageRepository extends JpaRepository<CompanionMessageEntity, UUID> {

    /**
     * Transaction-scoped advisory lock keyed on the user (bd mezo-d58h.4 concurrency fix):
     * {@code AdviceCardService.deliver} takes this before the incumbent read.
     * {@code FlagService.evaluateAndLog} can raise several flags in one evaluation, and each
     * raise's {@code FlagRaisedEvent} is handled {@code @Async} AFTER_COMMIT by
     * {@code InterventionEventListener} — so two {@code deliver} calls for the SAME user can run
     * on separate threads at the same time. Without this lock both read "no incumbent card yet",
     * both insert, and the partial unique index
     * {@code uq_companion_message_created_by_date_kind ... where is_deleted = false} lets exactly
     * one survive — whichever COMMITS first. That makes commit order, not {@code AdvicePriority},
     * decide the day's card, defeating S4's whole premise.
     *
     * <p>{@code pg_advisory_xact_lock} blocks a concurrent caller keyed on the same user until
     * THIS transaction commits or rolls back, then releases automatically — no unlock call, no
     * schema change, and it turns the read-then-write gate atomic against other deliveries for
     * the same user: a second caller queues, and once it acquires the lock it re-reads the now-
     * committed incumbent and compares real ranks. Deliberately the XACT (not SESSION) variant: a
     * session-scoped lock would outlive this method if it were ever called outside a transaction
     * and could deadlock later callers.
     *
     * <p><b>The actual invariant this depends on</b> is narrower than "call this first in
     * {@code deliver}": {@code deliver} JOINS the outer transaction at both real call sites
     * ({@code InterventionService.deliverForFlag} and {@code SetupCheckService.emit} are the
     * {@code @Transactional} boundary, and each does read-only {@code companion_message} /
     * {@code companion_flag_log} lookups — cooldown / re-emit-window checks — before calling
     * {@code deliver}), so this lock is first in the METHOD but not first in the TRANSACTION, and
     * it is held until the OUTER transaction commits. Correctness survives only because
     * everything before {@code deliver} in both callers is read-only: no writer may acquire a
     * {@code companion_message} row lock (or any lock this advisory lock could itself be waiting
     * behind) before this lock is taken in the same transaction, or the two would form a lock-
     * ordering cycle. If a future change adds a WRITE before {@code deliver} in either caller,
     * that invariant needs re-checking, not just "is the lock still called."
     *
     * <p><b>Requires READ COMMITTED</b> (the default, and what this app runs under): the whole
     * point is that the waiter, once it acquires the lock, re-reads the incumbent and sees the
     * winner's now-committed row. Under REPEATABLE READ the waiter's snapshot would predate the
     * lock acquisition, so it would still read "no incumbent" — the race would return, silently,
     * with the lock held and the code looking correct.
     *
     * <p>{@code hashtext} collapses the UUID to a 32-bit hash (Postgres implicitly widens it to
     * the {@code bigint} {@code pg_advisory_xact_lock} wants) — it is NOT injective, so two
     * unrelated users' UUIDs can hash to the same key. A collision only costs one of them a brief
     * lock wait; it never affects correctness, since the lock only serializes each user's own
     * {@code deliver} calls against each other and never reads or writes the other user's rows.
     */
    @Query(value = "select pg_advisory_xact_lock(hashtext(cast(:userId as text)))",
            nativeQuery = true)
    void lockForDelivery(@Param("userId") UUID userId);

    Optional<CompanionMessageEntity> findByCreatedByAndMessageDateAndKind(
            UUID createdBy, LocalDate messageDate, String kind);

    List<CompanionMessageEntity> findByCreatedByAndMessageDateOrderByGeneratedAtAsc(
            UUID createdBy, LocalDate messageDate);

    /** W5.2 per-key cooldown lookback (bd mezo-b3pp.19): recent intervention cards, key read
     *  from the envelope in memory — single-user volumes, no jsonb query needed. */
    List<CompanionMessageEntity> findByCreatedByAndKindAndGeneratedAtAfter(
            UUID createdBy, String kind, Instant after);

    /** Owner-scoped load for the S5 apply path (the {@code ExperimentRepository} precedent): a card
     *  belonging to someone else, or one superseded into {@code is_deleted = true}, simply is not
     *  found — the caller turns that into a 404 rather than leaking existence. */
    Optional<CompanionMessageEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
}
