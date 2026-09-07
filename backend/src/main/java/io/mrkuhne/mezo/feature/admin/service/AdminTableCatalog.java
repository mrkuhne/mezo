package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.feature.admin.repository.AdminCatalogQuery;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * The allowlist of browsable tables and columns, built once from {@code information_schema}
 * and cached (mezo-d5iy).
 *
 * <p>Anything a request names is resolved through {@link #require} / {@link #requireColumn};
 * the SQL builders then emit the catalog's own strings, never the request's. Columns whose
 * name looks like a credential are dropped from the catalog entirely, so they cannot be
 * selected, sorted or filtered on.
 */
@Service
@RequiredArgsConstructor
public class AdminTableCatalog {

    /** Never browsable, whatever table they sit on. */
    private static final Pattern SECRET_COLUMN = Pattern.compile("(?i).*(password|secret|token|hash).*");

    private final AdminCatalogQuery query;
    private final AtomicReference<Map<String, AdminTable>> cache = new AtomicReference<>();

    /**
     * Browsable tables by name, insertion-ordered by table name.
     *
     * <p>{@code load()} is a pure {@code information_schema} read with no side effects, so a
     * benign race that runs it more than once under concurrent first access is harmless — every
     * caller still converges on one cached, immutable map. This never re-reads the shared
     * reference to decide what to return: on a successful {@code compareAndSet} it returns the
     * locally-held {@code loaded} value directly, and on a failed CAS (someone else installed a
     * map first) it re-reads the reference to hand back what that thread installed. If a
     * concurrent {@link #refresh()} clears the cache again in the gap between that failed CAS
     * and the re-read — the one window where the re-read could itself observe {@code null} — the
     * loop simply tries again instead of returning it, so this can never hand back {@code null}.
     */
    public Map<String, AdminTable> tables() {
        Map<String, AdminTable> cached = cache.get();
        while (cached == null) {
            Map<String, AdminTable> loaded = load();
            if (cache.compareAndSet(null, loaded)) {
                return loaded;
            }
            cached = cache.get();
        }
        return cached;
    }

    /** Drops the cache; the next {@link #tables()} rebuilds it (after a migration). */
    public void refresh() {
        cache.set(null);
    }

    /** @throws SystemRuntimeErrorException 400 {@code ADMIN_TABLE_UNKNOWN} if not browsable. */
    public AdminTable require(String table) {
        AdminTable found = tables().get(table);
        if (found == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_TABLE_UNKNOWN").build(), HttpStatus.BAD_REQUEST);
        }
        return found;
    }

    /** @throws SystemRuntimeErrorException 400 {@code ADMIN_COLUMN_UNKNOWN} if absent or hidden. */
    public AdminColumn requireColumn(AdminTable table, String column) {
        return table.column(column)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("ADMIN_COLUMN_UNKNOWN").build(), HttpStatus.BAD_REQUEST));
    }

    private Map<String, AdminTable> load() {
        Map<String, Map<String, String>> fks = new LinkedHashMap<>();
        query.foreignKeys().forEach(fk ->
                fks.computeIfAbsent(fk.table(), t -> new LinkedHashMap<>()).put(fk.column(), fk.references()));

        Map<String, List<AdminColumn>> byTable = new LinkedHashMap<>();
        for (var row : query.columns()) {
            if (SECRET_COLUMN.matcher(row.column()).matches()) {
                continue;
            }
            String references = fks.getOrDefault(row.table(), Map.of()).get(row.column());
            byTable.computeIfAbsent(row.table(), t -> new ArrayList<>())
                    .add(new AdminColumn(row.column(), row.type(), references != null, references));
        }
        Map<String, AdminTable> result = new LinkedHashMap<>();
        byTable.forEach((name, columns) -> result.put(name, new AdminTable(name, List.copyOf(columns))));
        return Map.copyOf(result);
    }

    /** A browsable column. {@code dataType} is the {@code information_schema} type name. */
    public record AdminColumn(String name, String dataType, boolean foreignKey, String referencesTable) {

        /** True when the value is a bare calendar day rather than an instant. */
        public boolean isDate() {
            return "date".equals(dataType);
        }
    }

    /** A browsable table and its visible columns. */
    public record AdminTable(String name, List<AdminColumn> columns) {

        public Optional<AdminColumn> column(String columnName) {
            return columns.stream().filter(c -> c.name().equals(columnName)).findFirst();
        }

        public boolean hasColumn(String columnName) {
            return column(columnName).isPresent();
        }
    }
}
