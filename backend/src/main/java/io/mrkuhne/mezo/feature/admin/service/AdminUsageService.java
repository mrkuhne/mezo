package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminCostMatrixCell;
import io.mrkuhne.mezo.api.dto.AdminCostMatrixResponse;
import io.mrkuhne.mezo.api.dto.AdminCostMatrixUser;
import io.mrkuhne.mezo.api.dto.AdminDaySeries;
import io.mrkuhne.mezo.api.dto.AdminFeatureUsageResponse;
import io.mrkuhne.mezo.api.dto.AdminScreenUsageResponse;
import io.mrkuhne.mezo.api.dto.AdminScreenUsageRow;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.DayCountRow;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureDayRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUserFeatureRow;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenDayRow;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenEventRepository;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenUsageRow;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Feature-usage and cost-matrix insights (mezo-d5iy.6) — the last two panels behind {@code
 * /admin}: which features are used, on which days, and by whom (in dollars).
 *
 * <p>The cost matrix's opinionated bits: a null {@code created_by} is real cost (cron/stream
 * traffic), reported as a single synthetic user labelled {@code "Háttér"} (Hungarian for
 * "background") with a null id — never dropped, never merged into a named user; ERROR-status
 * calls are excluded entirely, since a failed call is not cost; and a row with a null {@code
 * cost_usd} is counted into {@code unknownCalls}, never folded into the cost sum as zero (ADR
 * 0014 — "unknown" is not "free").
 */
@Service
@RequiredArgsConstructor
public class AdminUsageService {

    private static final String HATTER_LABEL = "Háttér";

    private final AdminProperties properties;
    private final AdminTableCatalog catalog;
    private final AdminInsightsQuery query;
    private final AppUserRepository appUserRepository;
    private final LlmLogRepository llmLogRepository;
    /**
     * The screen-event log (mezo-o5cz). The dependency direction is deliberate and one-way:
     * {@code admin -> telemetry}; the telemetry slice never imports anything from here (ArchUnit
     * {@code feature_slices_are_cycle_free}). Injected unconditionally — with the screen-telemetry
     * switch off the table is simply empty, so this panel reads zeros instead of the admin hub
     * gaining a second, differently-gated 404.
     */
    private final ScreenEventRepository screenEventRepository;

    /** {@code 7d}/{@code 30d}/{@code 90d}; anything else (including {@code null}) is 30 days. */
    static int periodDays(String period) {
        return switch (period == null ? "30d" : period) {
            case "7d" -> 7;
            case "90d" -> 90;
            default -> 30;
        };
    }

    /**
     * Feature x day call counts (mezo-d5iy.6): one {@link AdminDaySeries} per feature, dense over
     * the period window. A feature appears if it is in EITHER source — the {@code
     * mezo.admin.feature-map} domain tables, or a distinct {@code feature} value in {@code
     * llm_log_history} — and the two sources are merged when a key happens to appear in both.
     * Series are sorted by their window total descending, then by key.
     */
    @Transactional(readOnly = true)
    public AdminFeatureUsageResponse featureUsage(String period) {
        int days = periodDays(period);
        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);
        LocalDate from = today.minusDays(days - 1L);
        List<LocalDate> window = from.datesUntil(today.plusDays(1)).toList();
        Instant since = from.atStartOfDay(zone).toInstant();

        Map<String, List<DayCountRow>> rowsByFeature = new LinkedHashMap<>();
        properties.featureMap().forEach((key, source) -> {
            AdminTable table = catalog.require(source.table());
            AdminColumn column = catalog.requireColumn(table, source.timestampColumn());
            rowsByFeature.computeIfAbsent(key, k -> new ArrayList<>())
                    .addAll(query.countByDay(table, column, from, zone));
        });
        for (LlmFeatureDayRow row : llmLogRepository.aggregateByFeatureAndDaySince(since, zone.getId())) {
            rowsByFeature.computeIfAbsent(row.getFeature(), k -> new ArrayList<>())
                    .add(new DayCountRow(row.getDay(), row.getCalls()));
        }

        List<AdminDaySeries> series = rowsByFeature.entrySet().stream()
                .map(entry -> {
                    var s = new AdminDaySeries();
                    s.setKey(entry.getKey());
                    s.setDays(AdminSeries.dense(window, entry.getValue()));
                    return s;
                })
                .sorted(Comparator
                        .comparingLong((AdminDaySeries s) -> s.getDays().stream().mapToLong(d -> d.getCount()).sum())
                        .reversed()
                        .thenComparing(AdminDaySeries::getKey))
                .toList();

        var response = new AdminFeatureUsageResponse();
        response.setPeriod(days + "d");
        response.setDays(window);
        response.setFeatures(series);
        return response;
    }

    /**
     * Screen x day view counts from the lean telemetry log (mezo-o5cz, spec §4). One row per
     * screen the window saw, sorted by views descending then screen ascending, each carrying a
     * DENSE daily series so the frontend's sparkline needs no gap logic — the same {@link
     * AdminSeries#dense} the other admin panels use.
     *
     * <p>{@code uniqueUsers} is a {@code count(distinct created_by)} over the window, not a sum of
     * daily uniques: the same person opening a screen on five days is one unique user, not five.
     * {@code lastSeenAt} is the newest {@code occurred_at} — the clamped, server-side-sane value,
     * never the raw client clock.
     */
    @Transactional(readOnly = true)
    public AdminScreenUsageResponse screenUsage(String period) {
        int days = periodDays(period);
        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);
        LocalDate from = today.minusDays(days - 1L);
        List<LocalDate> window = from.datesUntil(today.plusDays(1)).toList();
        Instant since = from.atStartOfDay(zone).toInstant();

        Map<String, List<DayCountRow>> daysByScreen = new LinkedHashMap<>();
        for (ScreenDayRow row : screenEventRepository.aggregateByScreenAndDaySince(since, zone.getId())) {
            daysByScreen.computeIfAbsent(row.getScreen(), k -> new ArrayList<>())
                    .add(new DayCountRow(row.getDay(), row.getViews()));
        }

        List<AdminScreenUsageRow> screens = screenEventRepository.aggregateByScreenSince(since).stream()
                .map((ScreenUsageRow row) -> {
                    var out = new AdminScreenUsageRow();
                    out.setScreen(row.getScreen());
                    out.setViews(row.getViews());
                    out.setUniqueUsers(row.getUniqueUsers());
                    out.setLastSeenAt(row.getLastSeenAt() == null
                            ? null : row.getLastSeenAt().atOffset(ZoneOffset.UTC));
                    out.setDays(AdminSeries.dense(window, daysByScreen.getOrDefault(row.getScreen(), List.of())));
                    return out;
                })
                .toList();

        var response = new AdminScreenUsageResponse();
        response.setPeriod(days + "d");
        response.setDays(window);
        response.setScreens(screens);
        return response;
    }

    /**
     * User x feature LLM cost (mezo-d5iy.6). Cells come straight off {@link
     * LlmLogRepository#aggregateByUserAndFeatureSince}; the user axis is every distinct account
     * that appears (resolved to a display label), plus the "Háttér" background entry when a
     * null-owner row exists; the feature axis is the distinct features, sorted by total cost
     * descending.
     */
    @Transactional(readOnly = true)
    public AdminCostMatrixResponse costMatrix(String period) {
        int days = periodDays(period);
        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);
        Instant since = today.minusDays(days - 1L).atStartOfDay(zone).toInstant();

        List<LlmUserFeatureRow> rows = llmLogRepository.aggregateByUserAndFeatureSince(since, CallStatus.ERROR);

        List<AdminCostMatrixCell> cells = new ArrayList<>();
        Map<UUID, Double> costByUser = new LinkedHashMap<>();
        Map<String, Double> costByFeature = new LinkedHashMap<>();
        Set<UUID> userIds = new LinkedHashSet<>();
        Set<String> features = new LinkedHashSet<>();
        double[] total = {0.0};

        for (LlmUserFeatureRow row : rows) {
            double cost = row.costUsd() == null ? 0.0 : row.costUsd().doubleValue();
            var cell = new AdminCostMatrixCell();
            cell.setUserId(row.userId());
            cell.setFeature(row.feature());
            cell.setCalls(row.calls());
            cell.setCostUsd(cost);
            cell.setUnknownCalls(row.unknownCalls());
            cells.add(cell);

            userIds.add(row.userId());
            features.add(row.feature());
            costByUser.merge(row.userId(), cost, Double::sum);
            costByFeature.merge(row.feature(), cost, Double::sum);
            total[0] += cost;
        }

        Map<UUID, AppUserEntity> resolvedUsers = appUserRepository
                .findAllById(userIds.stream().filter(Objects::nonNull).toList()).stream()
                .collect(Collectors.toMap(AppUserEntity::getId, u -> u));

        List<AdminCostMatrixUser> users = new ArrayList<>();
        for (UUID userId : userIds) {
            var user = new AdminCostMatrixUser();
            user.setId(userId);
            if (userId == null) {
                user.setLabel(HATTER_LABEL);
            } else {
                AppUserEntity account = resolvedUsers.get(userId);
                user.setLabel(account == null ? userId.toString()
                        : (account.getName() != null && !account.getName().isBlank() ? account.getName() : account.getEmail()));
            }
            users.add(user);
        }
        users.sort(Comparator
                .comparingDouble((AdminCostMatrixUser u) -> costByUser.getOrDefault(u.getId(), 0.0))
                .reversed()
                .thenComparing(AdminCostMatrixUser::getLabel));

        List<String> sortedFeatures = features.stream()
                .sorted(Comparator
                        .comparingDouble((String f) -> costByFeature.getOrDefault(f, 0.0))
                        .reversed()
                        .thenComparing(Comparator.naturalOrder()))
                .toList();

        var response = new AdminCostMatrixResponse();
        response.setPeriod(days + "d");
        response.setUsers(users);
        response.setFeatures(sortedFeatures);
        response.setCells(cells);
        response.setTotalUsd(total[0]);
        return response;
    }
}
