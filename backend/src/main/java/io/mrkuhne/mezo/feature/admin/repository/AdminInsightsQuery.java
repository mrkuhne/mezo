package io.mrkuhne.mezo.feature.admin.repository;

import io.mrkuhne.mezo.feature.admin.service.AdminSqlDialect;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
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

    /** Total non-deleted rows each user owns, summed across every owned table. */
    public Map<UUID, Long> rowCountsByUser(List<AdminTable> tables) {
        String union = tables.stream()
                .filter(t -> t.hasColumn("created_by"))
                .map(t -> "select t.\"created_by\" as owner, count(*) as n from %s t where t.\"created_by\" is not null%s group by 1"
                        .formatted(dialect.quote(t.name()), dialect.notDeleted(t, "t")))
                .collect(Collectors.joining("\nunion all\n"));
        if (union.isEmpty()) {
            return Map.of();
        }
        String sql = "select owner, sum(n) as total from (\n%s\n) parts group by owner".formatted(union);
        Map<UUID, Long> result = new HashMap<>();
        jdbc.query(sql, new HashMap<>(), rs -> {
            result.put(rs.getObject("owner", UUID.class), rs.getLong("total"));
        });
        return result;
    }

    /** The most recent moment each user logged anything, across the given feature sources. */
    public Map<UUID, Instant> lastActivityByUser(List<TableColumn> sources, ZoneId zone) {
        List<String> parts = new ArrayList<>();
        for (TableColumn source : sources) {
            AdminTable table = source.table();
            AdminColumn column = source.column();
            String moment = column.isDate()
                    ? "(t.%s::timestamp at time zone :zone)".formatted(dialect.quote(column.name()))
                    : "t.%s".formatted(dialect.quote(column.name()));
            parts.add("select t.\"created_by\" as owner, max(%s) as at from %s t where t.\"created_by\" is not null%s group by 1"
                    .formatted(moment, dialect.quote(table.name()), dialect.notDeleted(table, "t")));
        }
        if (parts.isEmpty()) {
            return Map.of();
        }
        String sql = "select owner, max(at) as at from (\n%s\n) parts group by owner"
                .formatted(String.join("\nunion all\n", parts));
        Map<UUID, Instant> result = new HashMap<>();
        jdbc.query(sql, Map.of("zone", zone.getId()), rs -> {
            OffsetDateTime at = rs.getObject("at", OffsetDateTime.class);
            result.put(rs.getObject("owner", UUID.class), at == null ? null : at.toInstant());
        });
        return result;
    }

    /** Distinct days each user logged something in the window, across the given feature sources. */
    public Map<UUID, Integer> activeDaysByUser(List<TableColumn> sources, LocalDate from, ZoneId zone) {
        List<String> parts = new ArrayList<>();
        for (TableColumn source : sources) {
            AdminTable table = source.table();
            AdminColumn column = source.column();
            String day = dialect.dayExpression(column, "t");
            parts.add("select distinct t.\"created_by\" as owner, %s as d from %s t where %s >= :from and t.\"created_by\" is not null%s"
                    .formatted(day, dialect.quote(table.name()), day, dialect.notDeleted(table, "t")));
        }
        if (parts.isEmpty()) {
            return Map.of();
        }
        String sql = "select owner, count(distinct d) as n from (\n%s\n) parts group by owner"
                .formatted(String.join("\nunion all\n", parts));
        Map<UUID, Integer> result = new HashMap<>();
        jdbc.query(sql, Map.of("from", from, "zone", zone.getId()), rs -> {
            result.put(rs.getObject("owner", UUID.class), rs.getInt("n"));
        });
        return result;
    }

    /**
     * Every user's rows per day in one table, grouped by {@code (created_by, day)} (mezo-zde2) —
     * the users-LIST equivalent of {@link #countByDayForUser}: one query per feature-map table for
     * ALL users at once, rather than one query per (table, user) pair. At beta scale (dozens of
     * users, single-digit feature-map tables) this is one query per table, merged by the caller
     * across tables into each user's dense 90-day {@code activityByDay} array — acceptable per the
     * plan ruling; a real per-table-per-user query would be {@code tables x users}, far worse.
     */
    public List<UserDayCountRow> countByDayAllUsers(AdminTable table, AdminColumn dayColumn, LocalDate from, ZoneId zone) {
        String day = dialect.dayExpression(dayColumn, "t");
        String sql = """
                select t."created_by" as "owner", %s as "day", count(*) as "count"
                from %s t
                where %s >= :from and t."created_by" is not null%s
                group by 1, 2
                """.formatted(day, dialect.quote(table.name()), day, dialect.notDeleted(table, "t"));
        return jdbc.query(sql, Map.of("from", from, "zone", zone.getId()), (rs, i) -> new UserDayCountRow(
                (UUID) rs.getObject("owner"), rs.getObject("day", LocalDate.class), rs.getLong("count")));
    }

    /** One user's rows per day in one table, dense-filled by the caller. */
    public List<DayCountRow> countByDayForUser(AdminTable table, AdminColumn dayColumn, UUID userId,
            LocalDate from, ZoneId zone) {
        String day = dialect.dayExpression(dayColumn, "t");
        String sql = """
                select %s as "day", count(*) as "count"
                from %s t
                where %s >= :from and t."created_by" = :userId%s
                group by 1
                order by 1
                """.formatted(day, dialect.quote(table.name()), day, dialect.notDeleted(table, "t"));
        return jdbc.query(sql, Map.of("from", from, "zone", zone.getId(), "userId", userId),
                (rs, i) -> new DayCountRow(rs.getObject("day", LocalDate.class), rs.getLong("count")));
    }

    /** Live rows, reaped rows and the newest {@code created_at} for one user in one table.
     *  {@code app_user} is matched on {@code id}, every other table on {@code created_by}. */
    public TableFootprintRow footprint(AdminTable table, UUID userId) {
        String owner = "app_user".equals(table.name()) ? "\"id\"" : "\"created_by\"";
        String deleted = table.hasColumn("is_deleted")
                ? "count(*) filter (where t.\"is_deleted\")"
                : "0";
        String live = table.hasColumn("is_deleted")
                ? "count(*) filter (where not t.\"is_deleted\")"
                : "count(*)";
        String created = table.hasColumn("created_at") ? "max(t.\"created_at\")" : "null::timestamptz";
        String sql = "select %s as live, %s as reaped, %s as last_created from %s t where t.%s = :userId"
                .formatted(live, deleted, created, dialect.quote(table.name()), owner);
        return jdbc.queryForObject(sql, Map.of("userId", userId), (rs, i) -> {
            OffsetDateTime at = rs.getObject("last_created", OffsetDateTime.class);
            return new TableFootprintRow(table.name(), rs.getLong("live"), rs.getLong("reaped"),
                    at == null ? null : at.toInstant());
        });
    }

    /** A day bucket and its count. */
    public record DayCountRow(LocalDate day, long count) {}

    /** One user's one-day row count, as returned by {@link #countByDayAllUsers}. */
    public record UserDayCountRow(UUID owner, LocalDate day, long count) {}

    /** One table's contribution to a user's data inventory. */
    public record TableFootprintRow(String table, long rowCount, long deletedCount, Instant lastCreatedAt) {}

    /**
     * A resolved table/column pair backing one feature-map entry. Resolution (catalog lookups)
     * happens in the calling service, so this repository stays dependency-free of
     * {@link io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog}.
     */
    public record TableColumn(AdminTable table, AdminColumn column) {}
}
