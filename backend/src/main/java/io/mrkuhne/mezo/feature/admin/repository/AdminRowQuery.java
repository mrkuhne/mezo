package io.mrkuhne.mezo.feature.admin.repository;

import io.mrkuhne.mezo.feature.admin.service.AdminSqlDialect;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
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
 * boundary is meant to depend on it) and parsed into a Jackson tree via {@link #unwrap}, so the
 * response carries real nested JSON rather than a quoted string. {@code ObjectMapper} here is
 * {@code tools.jackson.databind.ObjectMapper} (Jackson 3) — the type Spring MVC's message
 * converters actually use in this app, not the {@code com.fasterxml} (Jackson 2) dependency that
 * only exists for Hibernate's jsonb entity mapping (see the pom.xml comment on the {@code
 * jackson-databind} dependency). Injecting the wrong ObjectMapper type here would fail to
 * autowire, since only the Jackson 3 one is a Spring bean.
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
                row.put(column.name(), isJson(column) ? unwrapJson(rs.getString(column.name()))
                        : rs.getObject(column.name()));
            }
            return row;
        });
        return new Page(rows, total == null ? 0L : total);
    }

    private boolean isJson(AdminColumn column) {
        return "json".equals(column.dataType()) || "jsonb".equals(column.dataType());
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

    /** One page of rows plus the unpaged total. */
    public record Page(List<Map<String, Object>> rows, long total) {}
}
