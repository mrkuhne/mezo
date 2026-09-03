package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Write-and-read-back access to the INSERT-only {@code llm_log_history} audit table (mezo-2zyu).
 * Retention scrubbing: {@link #scrubPayloadsOlderThan} (mezo-1y3p).
 */
public interface LlmLogRepository extends JpaRepository<LlmLogEntity, UUID> {

    /**
     * Call count + summed cost of every audit row written at or after {@code since} (mezo-h3gb) —
     * the single primitive behind the day/week/month summary, called once per period start.
     *
     * <p>Deliberately NOT filtered by {@code created_by}: cron- and async-written rows carry a null
     * owner, and a user filter would silently drop the highest-volume traffic from the cost report.
     *
     * <p>An ungrouped aggregate always yields exactly one row, so the result is never null: on an
     * empty period it is {@code (0, null)} — {@code sum} over no priced row is SQL NULL, and that
     * null is carried out verbatim rather than coalesced to 0.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmUsageAggregate(
            count(l), sum(l.costUsd))
        from LlmLogEntity l
        where l.createdAt >= :since
        """)
    LlmUsageAggregate aggregateSince(@Param("since") Instant since);

    /** Per-user napi rollup (mezo-qw37.7) — a Memória/Audit panel csak a saját hívásait látja;
     *  a created_by IS NULL sorok (S6 előtti cron-forgalom) senkihez sem tartoznak. */
    @Query(value = """
        select (l.created_at at time zone :zone)::date as "day",
               count(*) as "calls",
               coalesce(sum(l.prompt_tokens), 0) as "inputTokens",
               coalesce(sum(coalesce(l.candidates_tokens, 0) + coalesce(l.thoughts_tokens, 0)), 0) as "outputTokens",
               sum(l.cost_usd) as "costUsd"
        from llm_log_history l
        where l.created_at >= :since and l.created_by = :userId
        group by 1
        order by 1
        """, nativeQuery = true)
    List<LlmDailyAggregate> aggregatePerDaySinceForUser(@Param("since") Instant since,
            @Param("zone") String zone, @Param("userId") UUID userId);

    /**
     * Per-status slice of a period (mezo-uakh) — call count, cost sum and unpriced count in ONE
     * grouped pass. Deliberately NOT filtered by {@code created_by}: cron- and stream-written rows
     * carry a null owner, and an ownership filter would hide the highest-volume traffic.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmStatusRow(
            l.status, count(l), sum(l.costUsd),
            sum(case when l.costUsd is null then 1L else 0L end))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.status
        """)
    List<LlmStatusRow> aggregateByStatusSince(@Param("since") Instant since);

    /** Feature rollup for the page header; ordering is done in the service (see its javadoc). */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmGroupRow(
            l.feature, count(l), sum(l.costUsd))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.feature
        """)
    List<LlmGroupRow> aggregateByFeatureSince(@Param("since") Instant since);

    /** Served-model rollup. A null {@code servedModel} (ERROR rows) forms its own group. */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmGroupRow(
            l.servedModel, count(l), sum(l.costUsd))
        from LlmLogEntity l
        where l.createdAt >= :since
        group by l.servedModel
        """)
    List<LlmGroupRow> aggregateByModelSince(@Param("since") Instant since);

    /**
     * Per-account rollup (mezo-qw37.3). Ad-hoc left join onto {@code AppUserEntity} for the display
     * name — there is no JPA association from the audit row to the account on purpose (the row must
     * outlive the account). Background rows group under a null user.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmUserRow(
            l.createdBy, u.name, count(l), coalesce(sum(l.totalTokens), 0L), sum(l.costUsd))
        from LlmLogEntity l
        left join AppUserEntity u on u.id = l.createdBy
        where l.createdAt >= :since
        group by l.createdBy, u.name
        """)
    List<LlmUserRow> aggregateByUserSince(@Param("since") Instant since);

    /**
     * The browsable list (mezo-uakh): newest first, metadata only, every filter optional via the
     * {@code (:param is null or …)} idiom. No owner filter — same reason as the aggregates.
     *
     * <p>The caller asks for {@code limit + 1} rows: getting that many is how the service knows
     * more exist, without paying for a second {@code count(*)} on every load-more.
     */
    @Query("""
        select new io.mrkuhne.mezo.feature.llmlog.repository.LlmCallRow(
            l.id, l.createdBy, l.createdAt, l.feature, l.operation, l.callKind, l.status,
            l.requestedModel, l.servedModel, l.latencyMs, l.streamed, l.toolRounds,
            l.totalTokens, l.imageCount, l.embedInputCount, l.embedDimensions,
            l.costUsd, l.errorClass, l.errorCode)
        from LlmLogEntity l
        where l.createdAt >= :since
          and (:feature is null or l.feature = :feature)
          and (:status is null or l.status = :status)
          and (:callKind is null or l.callKind = :callKind)
          and (:userId is null or l.createdBy = :userId)
        order by l.createdAt desc
        """)
    List<LlmCallRow> findCalls(@Param("since") Instant since,
                               @Param("feature") String feature,
                               @Param("status") CallStatus status,
                               @Param("callKind") CallKind callKind,
                               @Param("userId") UUID userId,
                               Pageable pageable);

    /**
     * The mezo-1y3p retention primitive: one idempotent bulk UPDATE that NULLs the four payload
     * columns of every row older than {@code cutoff} and stamps {@code payloadScrubbedAt}. The
     * payload-presence predicate keeps the stamp honest (embed rows are never stamped) and the
     * {@code payloadScrubbedAt is null} guard makes re-runs free. Everything else on the row —
     * cost, tokens, pricing snapshot, attribution — is deliberately untouched, forever.
     */
    @Modifying(clearAutomatically = true)
    @Query("""
        update LlmLogEntity l
        set l.systemPrompt = null,
            l.conversationHistory = null,
            l.userMessage = null,
            l.responseText = null,
            l.payloadScrubbedAt = :now
        where l.createdAt < :cutoff
          and l.payloadScrubbedAt is null
          and (l.systemPrompt is not null
            or l.conversationHistory is not null
            or l.userMessage is not null
            or l.responseText is not null)
        """)
    int scrubPayloadsOlderThan(@Param("cutoff") Instant cutoff, @Param("now") Instant now);
}
