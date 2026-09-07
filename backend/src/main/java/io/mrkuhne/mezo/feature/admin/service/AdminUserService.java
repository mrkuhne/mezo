package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminDaySeries;
import io.mrkuhne.mezo.api.dto.AdminFeatureCost;
import io.mrkuhne.mezo.api.dto.AdminTableFootprint;
import io.mrkuhne.mezo.api.dto.AdminUserDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.TableColumn;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.TableFootprintRow;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUserFeatureRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUserRow;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Every account, enriched with its data footprint, LLM cost and activity (mezo-d5iy). */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final int WINDOW_DAYS = 30;
    private static final int SERIES_WINDOW_DAYS = 90;

    /** The only sortable keys; anything else is 400 ADMIN_COLUMN_UNKNOWN, same code the data
     *  browser uses for an unresolvable column. */
    private static final Set<String> SORTABLE = Set.of(
            "name", "createdAt", "lastActivityAt", "rowCount", "cost30dUsd", "activeDays30d");

    private final AdminProperties properties;
    private final AdminTableCatalog catalog;
    private final AdminInsightsQuery query;
    private final AppUserRepository appUserRepository;
    private final LlmLogRepository llmLogRepository;

    @Transactional(readOnly = true)
    public List<AdminUserInsightResponse> list(String q, String sort, String dir) {
        String effectiveSort = sort == null ? "lastActivityAt" : sort;
        String effectiveDir = dir == null ? "desc" : dir;
        if (!SORTABLE.contains(effectiveSort)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_COLUMN_UNKNOWN").build(), HttpStatus.BAD_REQUEST);
        }

        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);
        LocalDate from = today.minusDays(WINDOW_DAYS - 1L);
        Instant since = from.atStartOfDay(zone).toInstant();

        List<AdminTable> tables = catalog.tables().values().stream().toList();
        List<TableColumn> sources = properties.featureMap().values().stream()
                .map(source -> {
                    AdminTable table = catalog.require(source.table());
                    AdminColumn column = catalog.requireColumn(table, source.timestampColumn());
                    return new TableColumn(table, column);
                })
                .toList();

        Map<UUID, Long> rowCounts = query.rowCountsByUser(tables);
        Map<UUID, Instant> lastActivity = query.lastActivityByUser(sources, zone);
        Map<UUID, Integer> activeDays = query.activeDaysByUser(sources, from, zone);
        Map<UUID, BigDecimal> costByUser = new HashMap<>();
        for (LlmUserRow row : llmLogRepository.aggregateByUserSince(since)) {
            if (row.userId() != null) {
                costByUser.put(row.userId(), row.costUsd());
            }
        }

        AdminTable memoryVector = catalog.require("memory_vector");
        String needle = q == null || q.isBlank() ? null : q.toLowerCase(Locale.ROOT);

        List<AdminUserInsightResponse> result = new ArrayList<>(appUserRepository.findAll().stream()
                .filter(user -> needle == null
                        || user.getName().toLowerCase(Locale.ROOT).contains(needle)
                        || user.getEmail().toLowerCase(Locale.ROOT).contains(needle))
                .map(user -> toResponse(user, zone, rowCounts, lastActivity, activeDays, costByUser, memoryVector))
                .toList());

        boolean descending = !"asc".equalsIgnoreCase(effectiveDir);
        result.sort(comparator(effectiveSort, descending));
        return result;
    }

    /**
     * One user's activity, inventory and cost (mezo-d5iy.5): the enriched row (same derivation
     * as {@link #list}, for this id only), a 90-day activity series per feature-map key, the
     * table-by-table data footprint, and 30-day usage/cost split by feature.
     */
    @Transactional(readOnly = true)
    public AdminUserDetailResponse detail(UUID id) {
        AppUserEntity user = appUserRepository.findById(id)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("ADMIN_USER_NOT_FOUND").build(), HttpStatus.NOT_FOUND));

        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);
        LocalDate from30 = today.minusDays(WINDOW_DAYS - 1L);
        Instant since30 = from30.atStartOfDay(zone).toInstant();

        List<AdminTable> tables = catalog.tables().values().stream().toList();
        List<TableColumn> sources = properties.featureMap().values().stream()
                .map(source -> {
                    AdminTable table = catalog.require(source.table());
                    AdminColumn column = catalog.requireColumn(table, source.timestampColumn());
                    return new TableColumn(table, column);
                })
                .toList();

        // 1. The enriched row: reuse the same derivation as list(), for this id only.
        Map<UUID, Long> rowCounts = query.rowCountsByUser(tables);
        Map<UUID, Instant> lastActivity = query.lastActivityByUser(sources, zone);
        Map<UUID, Integer> activeDays = query.activeDaysByUser(sources, from30, zone);
        Map<UUID, BigDecimal> costByUser = new HashMap<>();
        for (LlmUserRow row : llmLogRepository.aggregateByUserSince(since30)) {
            if (row.userId() != null) {
                costByUser.put(row.userId(), row.costUsd());
            }
        }
        AdminTable memoryVector = catalog.require("memory_vector");
        AdminUserInsightResponse enriched =
                toResponse(user, zone, rowCounts, lastActivity, activeDays, costByUser, memoryVector);

        // 2. activitySeries: one AdminDaySeries per feature-map key, dense over the last 90 days.
        LocalDate from90 = today.minusDays(SERIES_WINDOW_DAYS - 1L);
        List<LocalDate> days90 = from90.datesUntil(today.plusDays(1)).toList();
        List<AdminDaySeries> activitySeries = new ArrayList<>();
        properties.featureMap().forEach((key, source) -> {
            AdminTable table = catalog.require(source.table());
            AdminColumn column = catalog.requireColumn(table, source.timestampColumn());
            var series = new AdminDaySeries();
            series.setKey(key);
            series.setDays(AdminSeries.dense(days90, query.countByDayForUser(table, column, id, from90, zone)));
            activitySeries.add(series);
        });

        // 3. inventory: query.footprint(table, id) for every catalog table, dropping tables the
        //    user owns nothing in, sorted by rowCount descending. app_user is kept: it is matched
        //    on `id` rather than `created_by`, but the single row IS the account's own footprint
        //    (its live/deleted counts are meaningful the same way every other table's are), so
        //    there is no reason to special-case it out of the inventory.
        List<AdminTableFootprint> inventory = tables.stream()
                .map(table -> query.footprint(table, id))
                .filter(row -> row.rowCount() + row.deletedCount() > 0)
                .sorted(Comparator.comparingLong(TableFootprintRow::rowCount).reversed())
                .map(row -> {
                    var footprint = new AdminTableFootprint();
                    footprint.setTable(row.table());
                    footprint.setRowCount(row.rowCount());
                    footprint.setDeletedCount(row.deletedCount());
                    footprint.setLastCreatedAt(toOffsetDateTime(row.lastCreatedAt(), zone));
                    return footprint;
                })
                .toList();

        // 4. featureUsage30d: per feature-map key, query.countByDayForUser summed over the
        //    30-day window, merged with the per-user LLM call counts for that same feature key
        //    (Task 6's LlmUserFeatureRow query doesn't exist yet; aggregateByFeatureSinceForUser,
        //    added below, is this task's minimal per-user equivalent).
        List<LlmUserFeatureRow> llmFeatureRows =
                llmLogRepository.aggregateByFeatureSinceForUser(since30, id, CallStatus.ERROR);
        Map<String, Long> featureUsage30d = new HashMap<>();
        properties.featureMap().forEach((key, source) -> {
            AdminTable table = catalog.require(source.table());
            AdminColumn column = catalog.requireColumn(table, source.timestampColumn());
            long total = query.countByDayForUser(table, column, id, from30, zone).stream()
                    .mapToLong(AdminInsightsQuery.DayCountRow::count)
                    .sum();
            featureUsage30d.merge(key, total, Long::sum);
        });
        llmFeatureRows.forEach(row -> {
            if (row.feature() != null) {
                featureUsage30d.merge(row.feature(), row.calls(), Long::sum);
            }
        });

        // 5. costByFeature30d: the per-user feature rows, ERROR excluded, null cost_usd counted
        //    into unknownCalls rather than reported as zero cost.
        List<AdminFeatureCost> costByFeature30d = llmFeatureRows.stream()
                .map(row -> {
                    var cost = new AdminFeatureCost();
                    cost.setFeature(row.feature());
                    cost.setCalls(row.calls());
                    cost.setCostUsd(row.costUsd() == null ? 0.0 : row.costUsd().doubleValue());
                    cost.setUnknownCalls(row.unknownCalls());
                    return cost;
                })
                .toList();

        return AdminUserDetailResponse.builder()
                .user(enriched)
                .activitySeries(activitySeries)
                .inventory(inventory)
                .featureUsage30d(featureUsage30d)
                .costByFeature30d(costByFeature30d)
                .build();
    }

    private AdminUserInsightResponse toResponse(AppUserEntity user, ZoneId zone,
            Map<UUID, Long> rowCounts, Map<UUID, Instant> lastActivity, Map<UUID, Integer> activeDays,
            Map<UUID, BigDecimal> costByUser, AdminTable memoryVector) {
        UUID id = user.getId();
        var response = new AdminUserInsightResponse();
        response.setId(id);
        response.setEmail(user.getEmail());
        response.setName(user.getName());
        response.setRole(AdminUserInsightResponse.RoleEnum.valueOf(user.getRole().name()));
        response.setStatus(AdminUserInsightResponse.StatusEnum.valueOf(user.getStatus().name()));
        response.setCreatedAt(toOffsetDateTime(user.getCreatedAt(), zone));
        response.setOnboardedAt(toOffsetDateTime(user.getOnboardedAt(), zone));
        response.setLastSeenAt(toOffsetDateTime(user.getLastSeenAt(), zone));
        response.setLastActivityAt(toOffsetDateTime(lastActivity.get(id), zone));
        response.setRowCount(rowCounts.getOrDefault(id, 0L));
        response.setVectorCount(query.rowCount(memoryVector, id, false));
        BigDecimal cost = costByUser.get(id);
        response.setCost30dUsd(cost == null ? 0.0 : cost.doubleValue());
        response.setActiveDays30d(activeDays.getOrDefault(id, 0));
        return response;
    }

    /**
     * {@code descending} flips the ordering of non-null values; nulls sort last regardless of
     * direction (the {@code nullsLast} wrap sits outside the possibly-reversed natural order, so
     * reversing never pulls nulls to the front).
     */
    private static Comparator<AdminUserInsightResponse> comparator(String sort, boolean descending) {
        return switch (sort) {
            case "name" -> byKey(AdminUserInsightResponse::getName, descending);
            case "createdAt" -> byKey(AdminUserInsightResponse::getCreatedAt, descending);
            case "rowCount" -> byKey(AdminUserInsightResponse::getRowCount, descending);
            case "cost30dUsd" -> byKey(AdminUserInsightResponse::getCost30dUsd, descending);
            case "activeDays30d" -> byKey(AdminUserInsightResponse::getActiveDays30d, descending);
            default -> byKey(AdminUserInsightResponse::getLastActivityAt, descending);
        };
    }

    private static <T extends Comparable<T>> Comparator<AdminUserInsightResponse> byKey(
            Function<AdminUserInsightResponse, T> key, boolean descending) {
        Comparator<T> natural = descending ? Comparator.<T>naturalOrder().reversed() : Comparator.naturalOrder();
        return Comparator.comparing(key, Comparator.nullsLast(natural));
    }

    private static OffsetDateTime toOffsetDateTime(Instant instant, ZoneId zone) {
        return instant == null ? null : instant.atZone(zone).toOffsetDateTime();
    }
}
