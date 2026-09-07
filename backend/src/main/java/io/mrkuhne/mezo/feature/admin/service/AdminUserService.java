package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminUserInsightResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.TableColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
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
