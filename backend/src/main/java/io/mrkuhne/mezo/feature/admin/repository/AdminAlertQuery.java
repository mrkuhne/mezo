package io.mrkuhne.mezo.feature.admin.repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Install-wide freshness/health counts for the owner alert rules (mezo-kjwa). Fixed table names
 * only — this class never interpolates request input, so no {@link
 * io.mrkuhne.mezo.feature.admin.service.AdminSqlDialect} quoting is needed.
 *
 * <p>Unlike {@link io.mrkuhne.mezo.feature.companion.memory.repository.MemoryHealthQuery}, these
 * reads are NOT gated on the companion feature switch
 * and carry NO {@code userId} filter: the alert rules look at the whole installation, not one
 * inspected user, and the calling service ({@code AdminAlertService}) decides whether the
 * companion-dependent rules run at all.
 */
@Repository
@RequiredArgsConstructor
public class AdminAlertQuery {

    private static final String FAILED_MEMORY_VECTORS = """
        select count(*) from memory_vector where is_deleted = false and status = 'failed'
        """;

    /** Present but ANN-ineligible: same predicate as {@code MemoryHealthQuery#STALE_VECTORS},
     *  minus the per-user filter. */
    private static final String STALE_MEMORY_VECTORS = """
        select count(*) from memory_vector v
        join memory_item i on i.id = v.memory_item_id
        where v.is_deleted = false and v.status = 'ready'
          and v.embedded_content_hash <> i.content_hash
        """;

    /** There is no job-run table (same rationale as {@code MemoryHealthQuery#JOBS}): the nightly
     *  daily-summary pass's freshness is inferred from the newest row it wrote, install-wide. */
    private static final String NEWEST_DAILY_SUMMARY = """
        select max(created_at) from daily_summary where is_deleted = false
        """;

    private final NamedParameterJdbcTemplate jdbc;

    /** Same idiom as {@code AdminRowQuery#applyStatementTimeout} / {@code
     *  AdminDataBrowserService}: applied first, inside the caller's read-only transaction. */
    public void applyStatementTimeout(String timeout) {
        jdbc.getJdbcTemplate().execute("SET LOCAL statement_timeout = '" + timeout + "'");
    }

    public long failedMemoryVectors() {
        Long count = jdbc.getJdbcTemplate().queryForObject(FAILED_MEMORY_VECTORS, Long.class);
        return count == null ? 0L : count;
    }

    public long staleMemoryVectors() {
        Long count = jdbc.getJdbcTemplate().queryForObject(STALE_MEMORY_VECTORS, Long.class);
        return count == null ? 0L : count;
    }

    public Optional<Instant> newestDailySummaryAt() {
        OffsetDateTime at = jdbc.getJdbcTemplate().queryForObject(NEWEST_DAILY_SUMMARY, OffsetDateTime.class);
        return Optional.ofNullable(at).map(OffsetDateTime::toInstant);
    }
}
