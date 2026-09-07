package io.mrkuhne.mezo.feature.admin.repository;

import io.mrkuhne.mezo.feature.admin.service.AdminSqlDialect;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import java.sql.Array;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * The generic paginated row reader (mezo-d5iy).
 *
 * <p>The projection is the catalog's visible column list, so a credential (or {@code
 * USER-DEFINED}, e.g. pgvector) column can never be returned even by {@code select *}. Every
 * statement runs inside the caller's read-only transaction after {@link #applyStatementTimeout},
 * so a runaway scan is cut off.
 *
 * <p>{@code jsonb}/{@code json} columns are read with {@code ResultSet#getString} (the
 * PostgreSQL JDBC driver hands back the JSON text for these types, independent of the driver's
 * {@code org.postgresql.util.PGobject} wrapper type, which is {@code runtime}-scoped in this
 * project's pom — not on the compile classpath, on purpose, since nothing above the driver
 * boundary is meant to depend on it) and parsed into a Jackson tree via {@link #unwrapJson}, so
 * the response carries real nested JSON rather than a quoted string. {@code ObjectMapper} here is
 * {@code tools.jackson.databind.ObjectMapper} (Jackson 3) — the type Spring MVC's message
 * converters actually use in this app, not the {@code com.fasterxml} (Jackson 2) dependency that
 * only exists for Hibernate's jsonb entity mapping (see the pom.xml comment on the {@code
 * jackson-databind} dependency). Injecting the wrong ObjectMapper type here would fail to
 * autowire, since only the Jackson 3 one is a Spring bean.
 *
 * <p>{@code ARRAY} columns (e.g. {@code text[]}, reported by {@code information_schema} as the
 * literal string {@code "ARRAY"} rather than a concrete element type) and {@code tsvector}
 * columns get the same treatment (final review Finding 2, {@link #readCell}): read with a
 * driver accessor ({@code getArray}/{@code getString}) and converted to a plain {@link List} or
 * {@link String} INSIDE the row mapper, before the connection returns to the pool — never left
 * as a raw {@link java.sql.Array}/{@code PGobject} for Jackson to serialize post-commit, which
 * has no registered handler for either and either leaks driver internals or 500s.
 */
@Repository
@RequiredArgsConstructor
public class AdminRowQuery {

    private final NamedParameterJdbcTemplate jdbc;
    private final AdminSqlDialect dialect;
    private final ObjectMapper objectMapper;

    /**
     * Applies the statement timeout to the current transaction. {@code SET LOCAL} only has
     * effect inside an open transaction, so this must be called from inside the service's
     * {@code @Transactional(readOnly = true)} method, never before it.
     */
    public void applyStatementTimeout(String timeout) {
        jdbc.getJdbcTemplate().execute("SET LOCAL statement_timeout = '" + timeout + "'");
    }

    public Page page(AdminTable table, String ownerColumn, UUID userId, AdminColumn sort, String dir,
            int page, int size, boolean includeDeleted) {
        String projection = table.columns().stream()
                .map(c -> "t." + dialect.quote(c.name()))
                .collect(Collectors.joining(", "));
        StringBuilder where = new StringBuilder(" where true");
        Map<String, Object> params = new HashMap<>();
        if (!includeDeleted) {
            where.append(dialect.notDeleted(table, "t"));
        }
        if (userId != null) {
            where.append(" and t.").append(dialect.quote(ownerColumn)).append(" = :userId");
            params.put("userId", userId);
        }
        String from = " from %s t%s".formatted(dialect.quote(table.name()), where);

        Long total = jdbc.queryForObject("select count(*)" + from, params, Long.class);

        params.put("limit", size);
        params.put("offset", (long) page * size);
        String order = " order by t.%s %s".formatted(dialect.quote(sort.name()), "asc".equals(dir) ? "asc" : "desc");
        String sql = "select " + projection + from + order + " limit :limit offset :offset";

        List<Map<String, Object>> rows = jdbc.query(sql, params, (rs, i) -> {
            Map<String, Object> row = new LinkedHashMap<>();
            for (AdminColumn column : table.columns()) {
                row.put(column.name(), readCell(rs, column));
            }
            return row;
        });
        return new Page(rows, total == null ? 0L : total);
    }

    /**
     * Reads one cell, dispatching on {@code information_schema.columns.data_type} the same way
     * {@link #isJson} already did — jsonb/json get a parsed tree, {@code text[]}/etc. (reported
     * as {@code ARRAY}) get a materialized {@link List}, {@code tsvector} gets its text form, and
     * everything else falls through to {@code getObject}. All three special cases are read via
     * driver-provided accessors ({@code getString}/{@code getArray}) INSIDE this row mapper, i.e.
     * while the statement's connection is still open — never deferred to Jackson serialization
     * after the read-only transaction commits and the connection returns to the pool, which is
     * exactly the bug this method fixes for arrays/tsvector (final review Finding 2): a raw
     * {@link java.sql.Array}/{@code PGobject} handed to Jackson post-commit either exposes driver
     * internals or 500s on response write, because neither has a registered serializer.
     */
    private Object readCell(java.sql.ResultSet rs, AdminColumn column) throws java.sql.SQLException {
        if (isJson(column)) {
            return unwrapJson(rs.getString(column.name()));
        }
        if (isArray(column)) {
            return unwrapArray(rs.getArray(column.name()));
        }
        if (isTsvector(column)) {
            // tsvector has no natural JSON shape; render it as the same lexeme text `\dS+`/psql
            // would show (e.g. "'fish':2 'run':1") rather than trying to structure it.
            return rs.getString(column.name());
        }
        return rs.getObject(column.name());
    }

    private boolean isJson(AdminColumn column) {
        return "json".equals(column.dataType()) || "jsonb".equals(column.dataType());
    }

    private boolean isArray(AdminColumn column) {
        return "ARRAY".equals(column.dataType());
    }

    private boolean isTsvector(AdminColumn column) {
        return "tsvector".equals(column.dataType());
    }

    private Object unwrapJson(String json) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readTree(json);
        } catch (JacksonException e) {
            return json;
        }
    }

    /**
     * Materializes a JDBC {@link Array} into a plain {@link List} so Jackson can serialize it as
     * a normal JSON array — done here, synchronously, inside the row mapper, while the backing
     * connection is still open (see {@link #readCell}).
     */
    private Object unwrapArray(Array array) throws java.sql.SQLException {
        if (array == null) {
            return null;
        }
        Object raw = array.getArray();
        return raw instanceof Object[] elements ? Arrays.asList(elements) : raw;
    }

    /** One page of rows plus the unpaged total. */
    public record Page(List<Map<String, Object>> rows, long total) {}
}
