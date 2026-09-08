package io.mrkuhne.mezo.feature.admin.repository;

import io.mrkuhne.mezo.feature.admin.service.AdminSqlDialect;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import java.sql.Array;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Funkciók scorecard/detail analytics (mezo-l096.1..4): p90/p50 latency, live feedback state,
 * feedback trend, recall totals and per-user weekly-activity stats for the domain feature-map
 * tables. Every native read here follows the {@code AdminInsightsQuery} idiom — fixed identifiers
 * or {@link AdminSqlDialect}-quoted catalog names, values always bound, {@code
 * applyStatementTimeout} first — plus the explicit {@code is_deleted = false} every native read
 * of a soft-deleted table needs (JPA's {@code @SQLRestriction} does not apply to native SQL).
 *
 * <p>Deviations from the plan's interface sketch, both driven by the plan's own Rulings section:
 * <ul>
 *   <li>{@link #feedbackByFeature()} takes no {@code since} — the ruling is "helped-ratio =
 *       current state" (live up/down counts per {@code artifact_kind}), not a windowed count.</li>
 *   <li>{@link #domainFeatureUserStats} and {@link #llmActiveWeeksByFeatureAndUser} return the
 *       ISO-week labels a user was active in (via {@code array_agg}), not just a count — the
 *       scorecard's habit rule ("active in >= 3 of the last 4 ISO weeks") needs the actual label
 *       set, and merging a domain source with an LLM source for a {@code both}-kind feature must
     *   union those sets rather than sum two counts that could double-count an overlapping week.</li>
 * </ul>
 */
@Repository
@RequiredArgsConstructor
public class AdminFeatureQuery {

    private final NamedParameterJdbcTemplate jdbc;
    private final AdminSqlDialect dialect;

    /** Same idiom as {@code AdminAlertQuery#applyStatementTimeout} — applied first, inside the
     *  caller's read-only transaction. */
    public void applyStatementTimeout(String timeout) {
        jdbc.getJdbcTemplate().execute("SET LOCAL statement_timeout = '" + timeout + "'");
    }

    /**
     * p50/p90 latency (milliseconds, rounded to the nearest int) per LLM feature since {@code
     * since}. A feature with no row in the window is simply absent from the map — the caller
     * decides what "no sample" means for its own field.
     */
    public Map<String, int[]> p90LatencyByFeature(Instant since) {
        String sql = """
            select feature as "feature",
                   cast(round(percentile_cont(0.5) within group (order by latency_ms)) as int) as "p50",
                   cast(round(percentile_cont(0.9) within group (order by latency_ms)) as int) as "p90"
            from llm_log_history
            where created_at >= :since
            group by feature
            """;
        Map<String, int[]> result = new HashMap<>();
        jdbc.query(sql, Map.of("since", Timestamp.from(since)), rs -> {
            result.put(rs.getString("feature"), new int[]{rs.getInt("p50"), rs.getInt("p90")});
        });
        return result;
    }

    /**
     * Live verdict/reason state over {@code message_feedback} (mezo-l096.1 ruling: helped-ratio is
     * "current state", not a windowed sum). One row per {@code (artifact_kind, verdict, reason)}
     * combination present — {@code reason} is null for {@code verdict = up} rows (the schema's own
     * {@code ck_message_feedback_reason} check: a reason only ever accompanies a down verdict).
     * Explicit {@code is_deleted = false}: this is a native read, so JPA's {@code @SQLRestriction}
     * on {@link io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity} does not
     * apply.
     */
    public List<FeedbackKindRow> feedbackByFeature() {
        String sql = """
            select artifact_kind as "kind", verdict as "verdict", reason as "reason", count(*) as "count"
            from message_feedback
            where is_deleted = false
            group by 1, 2, 3
            """;
        return jdbc.query(sql, new HashMap<>(), (rs, i) -> new FeedbackKindRow(
                rs.getString("kind"), rs.getString("verdict"), rs.getString("reason"), rs.getLong("count")));
    }

    /**
     * Weekly up/down trend for one {@code artifact_kind}, bucketed on {@code updated_at} (mezo-
     * l096.1 ruling: "legutóbbi vélemények" semantics — flipping a vote re-dates it into the week
     * it was flipped in, it does not stay in the week it was first cast).
     */
    public List<FeedbackTrendRow> feedbackTrendByKind(String kind, Instant since, ZoneId zone) {
        String sql = """
            select to_char((updated_at at time zone :zone)::date, 'IYYY-IW') as "week",
                   verdict as "verdict",
                   count(*) as "count"
            from message_feedback
            where is_deleted = false and artifact_kind = :kind and updated_at >= :since
            group by 1, 2
            order by 1
            """;
        return jdbc.query(sql, Map.of("kind", kind, "since", Timestamp.from(since), "zone", zone.getId()),
                (rs, i) -> new FeedbackTrendRow(rs.getString("week"), rs.getString("verdict"), rs.getLong("count")));
    }

    /** Counts per {@code action} over {@code memory_retrieval_feedback} since {@code since};
     *  missing actions are simply absent from the map (never a zero placeholder). */
    public Map<String, Long> recallFeedbackTotals(Instant since) {
        String sql = """
            select action as "action", count(*) as "count"
            from memory_retrieval_feedback
            where is_deleted = false and created_at >= :since
            group by 1
            """;
        Map<String, Long> result = new HashMap<>();
        jdbc.query(sql, Map.of("since", Timestamp.from(since)), rs -> {
            result.put(rs.getString("action"), rs.getLong("count"));
        });
        return result;
    }

    /**
     * Per-user usage stats for one domain feature-map table since {@code since}: call count, first/
     * last day, and the set of ISO-week labels ({@code IYYY-IW}) the user was active in on or after
     * {@code weeksSince} — the raw material for the "tried" (any row) and "habit" (>= 3 of the last
     * 4 ISO weeks) funnel rules. {@code created_by is not null} is filtered here rather than left
     * to the caller: cron/background rows are never a user for this funnel.
     */
    public List<DomainFeatureUserStatsRow> domainFeatureUserStats(AdminTable table, AdminColumn timestampColumn,
            Instant since, LocalDate weeksSince, ZoneId zone) {
        String day = dialect.dayExpression(timestampColumn, "t");
        String sql = """
            select t."created_by" as "owner",
                   count(*) as "calls",
                   min(%s) as "firstDay",
                   max(%s) as "lastDay",
                   array_agg(distinct to_char(%s, 'IYYY-IW')) filter (where %s >= :weeksSince) as "activeWeeks"
            from %s t
            where %s >= :since and t."created_by" is not null%s
            group by 1
            """.formatted(day, day, day, day, dialect.quote(table.name()), day, dialect.notDeleted(table, "t"));
        return jdbc.query(sql, Map.of("since", Timestamp.from(since), "weeksSince", weeksSince, "zone", zone.getId()), (rs, i) ->
                new DomainFeatureUserStatsRow(
                        (UUID) rs.getObject("owner"),
                        rs.getLong("calls"),
                        rs.getObject("firstDay", LocalDate.class),
                        rs.getObject("lastDay", LocalDate.class),
                        toStringList(rs.getArray("activeWeeks"))));
    }

    /**
     * The LLM-side equivalent of {@link #domainFeatureUserStats} over {@code llm_log_history} —
     * lives here rather than on {@link io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository}
     * because the ISO-week label set needs the driver's {@code getArray} accessor read INSIDE the
     * row mapper (same reasoning as {@code AdminRowQuery#unwrapArray}), which is awkward to express
     * through a Spring Data interface projection. ERROR-status calls are excluded (uses = non-ERROR
     * calls, same rule as every other usage aggregate over this table).
     */
    public List<LlmFeatureUserActivityRow> llmActiveWeeksByFeatureAndUser(Instant since, ZoneId zone,
            LocalDate weeksSince) {
        String sql = """
            select feature as "feature",
                   created_by as "createdBy",
                   count(*) as "calls",
                   array_agg(distinct to_char((created_at at time zone :zone)::date, 'IYYY-IW'))
                       filter (where (created_at at time zone :zone)::date >= :weeksSince) as "activeWeeks"
            from llm_log_history
            where created_at >= :since and status <> 'ERROR' and created_by is not null
            group by 1, 2
            """;
        return jdbc.query(sql, Map.of("since", Timestamp.from(since), "zone", zone.getId(), "weeksSince", weeksSince), (rs, i) ->
                new LlmFeatureUserActivityRow(
                        rs.getString("feature"),
                        (UUID) rs.getObject("createdBy"),
                        rs.getLong("calls"),
                        toStringList(rs.getArray("activeWeeks"))));
    }

    /**
     * Error-code histogram for ONE feature since {@code since} (Funkciók detail, mezo-l096.4) —
     * the {@code reliability.topErrors} panel. {@code error_code} is coalesced to {@code "unknown"}
     * since the contract field is non-nullable, ordered by count descending.
     */
    public List<TopErrorRow> topErrorsByFeature(String feature, Instant since) {
        String sql = """
            select coalesce(error_code, 'unknown') as "code", count(*) as "count"
            from llm_log_history
            where feature = :feature and status = 'ERROR' and created_at >= :since
            group by 1
            order by 2 desc
            """;
        return jdbc.query(sql, Map.of("feature", feature, "since", Timestamp.from(since)),
                (rs, i) -> new TopErrorRow(rs.getString("code"), rs.getLong("count")));
    }

    private static List<String> toStringList(Array array) throws java.sql.SQLException {
        if (array == null) {
            return List.of();
        }
        Object raw = array.getArray();
        if (raw instanceof Object[] elements) {
            List<String> out = new ArrayList<>(elements.length);
            for (Object element : elements) {
                if (element != null) {
                    out.add(element.toString());
                }
            }
            return out;
        }
        return Arrays.asList((String[]) raw);
    }

    /** One {@code (artifact_kind, verdict[, reason])} bucket of live {@code message_feedback}
     *  state; {@code reason} is null on every {@code verdict = up} row. */
    public record FeedbackKindRow(String kind, String verdict, String reason, long count) {}

    /** One ISO-week bucket of one artifact kind's feedback trend. */
    public record FeedbackTrendRow(String week, String verdict, long count) {}

    /** One user's usage footprint in one domain feature-map table.
     *
     * @param activeWeeks the distinct {@code IYYY-IW} labels this user was active in, restricted
     *     to days on/after the query's {@code weeksSince} bound */
    public record DomainFeatureUserStatsRow(UUID createdBy, long calls, LocalDate firstDay, LocalDate lastDay,
            List<String> activeWeeks) {}

    /** The LLM-side equivalent of {@link DomainFeatureUserStatsRow}, one row per (feature, user). */
    public record LlmFeatureUserActivityRow(String feature, UUID createdBy, long calls, List<String> activeWeeks) {}

    /** One error-code bucket of {@link #topErrorsByFeature}; {@code code} is never null
     *  ({@code "unknown"} stands in for a missing {@code error_code}). */
    public record TopErrorRow(String code, long count) {}
}
