package io.mrkuhne.mezo.feature.llmlog.repository;

import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Write-and-read-back access to the INSERT-only {@code llm_log_history} audit table (mezo-2zyu).
 * Query methods (feature/model rollups, retention pruning) arrive with the later tasks.
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

    /** Napi rollup (mezo-al1i) — naptári napok a report-zónában; a SUM a null költséget kihagyja. */
    @Query(value = """
        select (l.created_at at time zone :zone)::date as "day",
               count(*) as "calls",
               coalesce(sum(l.prompt_tokens), 0) as "inputTokens",
               coalesce(sum(coalesce(l.candidates_tokens, 0) + coalesce(l.thoughts_tokens, 0)), 0) as "outputTokens",
               sum(l.cost_usd) as "costUsd"
        from llm_log_history l
        where l.created_at >= :since
        group by 1
        order by 1
        """, nativeQuery = true)
    List<LlmDailyAggregate> aggregatePerDaySince(@Param("since") Instant since, @Param("zone") String zone);
}
