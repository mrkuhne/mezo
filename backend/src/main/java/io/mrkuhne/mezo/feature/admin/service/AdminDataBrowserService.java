package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminColumnDescriptor;
import io.mrkuhne.mezo.api.dto.AdminRowPageResponse;
import io.mrkuhne.mezo.api.dto.AdminTableDescriptor;
import io.mrkuhne.mezo.api.dto.AdminTableListResponse;
import io.mrkuhne.mezo.api.dto.AdminViewDescriptor;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminRowQuery;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The generic, read-only row browser over every owned table (mezo-d5iy.7): the last panel
 * behind {@code /admin}, driven entirely by {@link AdminTableCatalog}'s information_schema
 * allowlist rather than a hand-maintained table registry.
 *
 * <p><b>Injection boundary.</b> {@code table}, {@code sort}, and {@code userId} arrive from the
 * URL. {@code table} and {@code sort} are resolved through {@link AdminTableCatalog#require}
 * and {@link AdminTableCatalog#requireColumn} before anything reaches SQL, and the SQL text
 * itself is built by {@link AdminRowQuery} from the resolved catalog objects (re-quoted via
 * {@link AdminSqlDialect#quote}), never by concatenating the request string. {@code userId} is
 * always bound as a parameter, never interpolated. {@code page}/{@code size} are clamped, not
 * validated — an oversized {@code size} silently becomes the configured maximum rather than a
 * 400, per the brief's explicit "clamp, never reject".
 */
@Service
@RequiredArgsConstructor
public class AdminDataBrowserService {

    private final AdminTableCatalog catalog;
    private final AdminProperties properties;
    private final AdminConvenienceViews convenienceViews;
    private final AdminRowQuery rowQuery;

    /** Every browsable table, with its owner column and soft-delete capability. */
    public AdminTableListResponse tables() {
        var response = new AdminTableListResponse();
        catalog.tables().values().forEach(table -> response.addTablesItem(describe(table)));
        return response;
    }

    /**
     * The v1 convenience views. Each view's table and default-sort column are re-resolved
     * through the catalog on every call (cheap: the catalog is already cached) so a renamed or
     * dropped column fails loudly here instead of 400-ing the first time someone clicks the
     * view.
     */
    public List<AdminViewDescriptor> views() {
        return convenienceViews.views().stream().map(view -> {
            AdminTable table = catalog.require(view.table());
            catalog.requireColumn(table, view.defaultSort());
            var descriptor = new AdminViewDescriptor();
            descriptor.setId(view.id());
            descriptor.setLabel(view.label());
            descriptor.setTable(view.table());
            descriptor.setDefaultSort(view.defaultSort());
            descriptor.setDefaultDir("asc".equals(view.defaultDir())
                    ? AdminViewDescriptor.DefaultDirEnum.ASC : AdminViewDescriptor.DefaultDirEnum.DESC);
            return descriptor;
        }).toList();
    }

    /**
     * One page of rows from {@code tableName}. {@code SET LOCAL statement_timeout} is applied
     * first thing inside this transaction — {@code SET LOCAL} only affects the current
     * transaction, so it must run after {@code @Transactional} has actually opened one, which is
     * why {@link AdminRowQuery#applyStatementTimeout} is a separate call made from here rather
     * than folded into the connection setup.
     *
     * <p>A Postgres statement-timeout cancellation (SQLSTATE {@code 57014}) is translated by
     * Spring's {@code SQLStateSQLExceptionTranslator} into a {@link QueryTimeoutException} —
     * verified by decompiling the exact {@code spring-jdbc} jar on this project's classpath
     * (7.0.1): SQLSTATE class {@code 57} is one of {@code SQLStateSQLExceptionTranslator}'s
     * {@code DATA_ACCESS_RESOURCE_FAILURE_CODES}, and its {@code indicatesQueryTimeout} helper
     * matches exactly {@code "57014"} to pick {@code QueryTimeoutException} over the broader
     * {@code DataAccessResourceFailureException} sibling for every other code in that class.
     * PostgreSQL's own {@code SQLErrorCodes} entry (spring-jdbc's {@code sql-error-codes.xml})
     * does not list {@code 57xxx} in its custom {@code dataAccessResourceFailureCodes}, so
     * translation genuinely falls through to the SQLSTATE-class translator rather than being
     * short-circuited by the custom list. This was verified statically (bytecode inspection),
     * not by triggering a live 5s timeout in a test — doing that cheaply would mean either an
     * artificially tiny timeout (flaky under any CI/DB jitter) or a deliberately slow query
     * fixture, both more trouble than the verification above already resolves.
     */
    @Transactional(readOnly = true)
    public AdminRowPageResponse rows(String tableName, UUID userId, Integer page, Integer size, String sort,
            String dir, Boolean includeDeleted) {
        rowQuery.applyStatementTimeout("5s");
        try {
            AdminTable table = catalog.require(tableName);
            String ownerColumn = ownerColumn(table);
            AdminColumn sortColumn = resolveSort(table, sort);
            int clampedSize = clampSize(size);
            int safePage = page == null || page < 0 ? 0 : page;
            boolean deleted = Boolean.TRUE.equals(includeDeleted);

            AdminRowQuery.Page result = rowQuery.page(
                    table, ownerColumn, userId, sortColumn, dir, safePage, clampedSize, deleted);

            var response = new AdminRowPageResponse();
            response.setTable(tableName);
            response.setPage(safePage);
            response.setSize(clampedSize);
            response.setTotal(result.total());
            table.columns().forEach(column -> response.addColumnsItem(describeColumn(column)));
            result.rows().forEach(response::addRowsItem);
            return response;
        } catch (QueryTimeoutException e) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_QUERY_TIMEOUT").build(), HttpStatus.GATEWAY_TIMEOUT);
        }
    }

    private int clampSize(Integer requested) {
        int max = properties.browser().maxPageSize();
        if (requested == null || requested < 1) {
            return Math.min(50, max);
        }
        return Math.min(requested, max);
    }

    private AdminColumn resolveSort(AdminTable table, String sort) {
        if (sort != null && !sort.isBlank()) {
            return catalog.requireColumn(table, sort);
        }
        if (table.hasColumn("created_at")) {
            return table.column("created_at").orElseThrow();
        }
        return table.columns().get(0);
    }

    private String ownerColumn(AdminTable table) {
        return "app_user".equals(table.name()) ? "id" : "created_by";
    }

    private AdminTableDescriptor describe(AdminTable table) {
        var descriptor = new AdminTableDescriptor();
        descriptor.setName(table.name());
        descriptor.setOwnerColumn(ownerColumn(table));
        descriptor.setSoftDeletable(table.hasColumn("is_deleted"));
        table.columns().forEach(column -> descriptor.addColumnsItem(describeColumn(column)));
        return descriptor;
    }

    private AdminColumnDescriptor describeColumn(AdminColumn column) {
        var descriptor = new AdminColumnDescriptor();
        descriptor.setName(column.name());
        descriptor.setType(column.dataType());
        descriptor.setForeignKey(column.foreignKey());
        descriptor.setReferencesTable(column.referencesTable());
        return descriptor;
    }
}
