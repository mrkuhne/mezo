package io.mrkuhne.mezo.feature.admin.repository;

import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * Reads the browsable-table inventory out of {@code information_schema} (mezo-d5iy).
 *
 * <p>A table is browsable when it has a {@code created_by} column (every {@code OwnedEntity}
 * does), plus {@code app_user}, which is reachable through its {@code id}. No request value
 * ever reaches this SQL — the two statements are constant.
 */
@Repository
@RequiredArgsConstructor
public class AdminCatalogQuery {

    private static final String COLUMNS_SQL =
            """
            select c.table_name as "table", c.column_name as "column", c.data_type as "type"
            from information_schema.columns c
            where c.table_schema = 'public'
              and (c.table_name = 'app_user'
                   or c.table_name in (select table_name from information_schema.columns
                                       where table_schema = 'public' and column_name = 'created_by'))
            order by c.table_name, c.ordinal_position
            """;

    private static final String FOREIGN_KEYS_SQL =
            """
            select kcu.table_name as "table", kcu.column_name as "column", ccu.table_name as "references"
            from information_schema.table_constraints tc
            join information_schema.key_column_usage kcu
              on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
            join information_schema.constraint_column_usage ccu
              on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
            where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
            """;

    private final NamedParameterJdbcTemplate jdbc;

    /** One row per browsable column, in ordinal order. */
    public List<CatalogColumnRow> columns() {
        return jdbc.query(COLUMNS_SQL, Map.of(), (rs, i) ->
                new CatalogColumnRow(rs.getString("table"), rs.getString("column"), rs.getString("type")));
    }

    /** One row per single-column foreign key. */
    public List<CatalogForeignKeyRow> foreignKeys() {
        return jdbc.query(FOREIGN_KEYS_SQL, Map.of(), (rs, i) ->
                new CatalogForeignKeyRow(rs.getString("table"), rs.getString("column"), rs.getString("references")));
    }

    /** A column of a browsable table. */
    public record CatalogColumnRow(String table, String column, String type) {}

    /** A foreign key from {@code table.column} to {@code references}. */
    public record CatalogForeignKeyRow(String table, String column, String references) {}
}
