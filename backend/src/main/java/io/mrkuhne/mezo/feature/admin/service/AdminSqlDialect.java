package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import org.springframework.stereotype.Service;

/**
 * Turns catalog entries into SQL text (mezo-d5iy).
 *
 * <p>Identifiers are always double-quoted, so reserved words such as {@code date} are safe.
 * Only strings that came out of {@link AdminTableCatalog} are ever passed in, so quoting is
 * a correctness measure, not the injection defence — the allowlist is.
 */
@Service
public class AdminSqlDialect {

    /** Double-quotes an identifier, doubling any embedded quote. */
    public String quote(String identifier) {
        return '"' + identifier.replace("\"", "\"\"") + '"';
    }

    /**
     * The expression that reduces a feature-map column to a calendar day in the report zone.
     * A {@code date} column is already a day; an instant is shifted into the zone first.
     * The caller must bind {@code :zone}.
     */
    public String dayExpression(AdminColumn column, String alias) {
        String ref = alias + "." + quote(column.name());
        return column.isDate() ? ref : "(" + ref + " at time zone :zone)::date";
    }

    /** {@code and t.is_deleted = false} for tables that have the column, empty otherwise. */
    public String notDeleted(AdminTable table, String alias) {
        return table.hasColumn("is_deleted") ? " and " + alias + ".\"is_deleted\" = false" : "";
    }
}
