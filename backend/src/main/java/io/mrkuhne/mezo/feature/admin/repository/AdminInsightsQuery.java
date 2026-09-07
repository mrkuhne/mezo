package io.mrkuhne.mezo.feature.admin.repository;

import io.mrkuhne.mezo.feature.admin.service.AdminSqlDialect;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Native aggregates over the owned tables (mezo-d5iy).
 *
 * <p>Every table and column argument comes from {@link io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog};
 * values are always bound, identifiers are always quoted by {@link AdminSqlDialect}. Native SQL
 * bypasses JPA's {@code @SQLRestriction}, so the soft-delete predicate is emitted explicitly.
 */
@Repository
@RequiredArgsConstructor
public class AdminInsightsQuery {

    private final NamedParameterJdbcTemplate jdbc;
    private final AdminSqlDialect dialect;

    /** Rows per day between {@code from} and today, dense-filled by the caller. */
    public List<DayCountRow> countByDay(AdminTable table, AdminColumn dayColumn, LocalDate from, ZoneId zone) {
        String day = dialect.dayExpression(dayColumn, "t");
        String sql = """
                select %s as "day", count(*) as "count"
                from %s t
                where %s >= :from%s
                group by 1
                order by 1
                """.formatted(day, dialect.quote(table.name()), day, dialect.notDeleted(table, "t"));
        return jdbc.query(sql, Map.of("from", from, "zone", zone.getId()),
                (rs, i) -> new DayCountRow(rs.getObject("day", LocalDate.class), rs.getLong("count")));
    }

    /** Rows whose day column is on or after {@code from}. */
    public long countSince(AdminTable table, AdminColumn dayColumn, LocalDate from, ZoneId zone) {
        String day = dialect.dayExpression(dayColumn, "t");
        String sql = "select count(*) from %s t where %s >= :from%s"
                .formatted(dialect.quote(table.name()), day, dialect.notDeleted(table, "t"));
        Long count = jdbc.queryForObject(sql, Map.of("from", from, "zone", zone.getId()), Long.class);
        return count == null ? 0L : count;
    }

    /** Distinct users whose {@code last_seen_at} falls on each day. */
    public List<DayCountRow> activeUsersByDay(LocalDate from, ZoneId zone) {
        String sql = """
                select (u.last_seen_at at time zone :zone)::date as "day", count(distinct u.id) as "count"
                from app_user u
                where u.last_seen_at is not null and (u.last_seen_at at time zone :zone)::date >= :from
                group by 1
                order by 1
                """;
        return jdbc.query(sql, Map.of("from", from, "zone", zone.getId()),
                (rs, i) -> new DayCountRow(rs.getObject("day", LocalDate.class), rs.getLong("count")));
    }

    /** Users seen at least once on or after {@code from}. */
    public long activeUsersSince(LocalDate from, ZoneId zone) {
        String sql = """
                select count(*) from app_user u
                where u.last_seen_at is not null and (u.last_seen_at at time zone :zone)::date >= :from
                """;
        Long count = jdbc.queryForObject(sql, Map.of("from", from, "zone", zone.getId()), Long.class);
        return count == null ? 0L : count;
    }

    /** Rows a user owns in one table. {@code app_user} is matched on {@code id}. */
    public long rowCount(AdminTable table, UUID userId, boolean includeDeleted) {
        String owner = "app_user".equals(table.name()) ? "\"id\"" : "\"created_by\"";
        String sql = "select count(*) from %s t where t.%s = :userId%s".formatted(
                dialect.quote(table.name()), owner, includeDeleted ? "" : dialect.notDeleted(table, "t"));
        Long count = jdbc.queryForObject(sql, Map.of("userId", userId), Long.class);
        return count == null ? 0L : count;
    }

    /** Rows in one table, whole installation. */
    public long totalRowCount(AdminTable table) {
        String sql = "select count(*) from %s t where true%s"
                .formatted(dialect.quote(table.name()), dialect.notDeleted(table, "t"));
        Long count = jdbc.queryForObject(sql, new HashMap<>(), Long.class);
        return count == null ? 0L : count;
    }

    /** A day bucket and its count. */
    public record DayCountRow(LocalDate day, long count) {}
}
