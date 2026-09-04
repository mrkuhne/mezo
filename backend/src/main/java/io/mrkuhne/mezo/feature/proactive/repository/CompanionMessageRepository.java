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
     * {@code AdviceCardService.deliver} MUST take this as its first statement, before the
     * incumbent read. {@code FlagService.evaluateAndLog} can raise several flags in one
     * evaluation, and each raise's {@code FlagRaisedEvent} is handled {@code @Async}
     * AFTER_COMMIT by {@code InterventionEventListener} — so two {@code deliver} calls for the
     * SAME user can run on separate threads at the same time. Without this lock both read
     * "no incumbent card yet", both insert, and the partial unique index
     * {@code uq_companion_message_created_by_date_kind ... where is_deleted = false} lets exactly
     * one survive — whichever COMMITS first. That makes commit order, not {@code AdvicePriority},
     * decide the day's card, defeating S4's whole premise.
     *
     * <p>{@code pg_advisory_xact_lock} blocks a concurrent caller keyed on the same user until
     * THIS transaction commits or rolls back, then releases automatically — no unlock call, no
     * schema change, and it turns the read-then-write gate atomic against other deliveries for
     * the same user: a second caller queues, and once it acquires the lock it re-reads the now-
     * committed incumbent and compares real ranks. {@code hashtext} collapses the UUID to a
     * stable {@code int4}, which Postgres implicitly widens to the {@code bigint} the function
     * wants. Deliberately the XACT (not SESSION) variant: a session-scoped lock would outlive
     * this method if it were ever called outside a transaction and could deadlock later callers.
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
}
