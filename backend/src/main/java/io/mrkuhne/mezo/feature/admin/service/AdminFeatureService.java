package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminFeatureBoardResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureDownReason;
import io.mrkuhne.mezo.api.dto.AdminFeatureFeedbackPoint;
import io.mrkuhne.mezo.api.dto.AdminFeatureFunnel;
import io.mrkuhne.mezo.api.dto.AdminFeatureHelped;
import io.mrkuhne.mezo.api.dto.AdminFeatureModelCost;
import io.mrkuhne.mezo.api.dto.AdminFeatureReliability;
import io.mrkuhne.mezo.api.dto.AdminFeatureRow;
import io.mrkuhne.mezo.api.dto.AdminFeatureRow.KindEnum;
import io.mrkuhne.mezo.api.dto.AdminFeatureTopError;
import io.mrkuhne.mezo.api.dto.AdminFeatureTopUser;
import io.mrkuhne.mezo.api.dto.AdminFeedbackFeatureSummary;
import io.mrkuhne.mezo.api.dto.AdminFeedbackRecall;
import io.mrkuhne.mezo.api.dto.AdminFeedbackSummaryResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.DomainFeatureUserStatsRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.FeedbackKindRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.FeedbackTrendRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.LlmFeatureUserActivityRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.TopErrorRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.DayCountRow;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionFeatureFlag;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureDayRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureErrorRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureUserRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUserFeatureRow;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Funkciók scorecard, detail and feedback-summary aggregation (mezo-l096.1..4). {@link #board}
 * is the real mezo-l096.3 aggregation (Task 3); {@link #detail} and {@link #feedbackSummary}
 * remain the Task 1 skeleton — null/empty-filled — until Task 4.
 */
@Service
@RequiredArgsConstructor
public class AdminFeatureService {

    /** Funnel ruling: a user is "habitual" on a feature when active in >= 3 of the trailing
     *  {@link #HABIT_WINDOW_WEEKS} ISO weeks, regardless of the board's selected {@code period}. */
    private static final int HABIT_MIN_WEEKS = 3;
    private static final int HABIT_WINDOW_WEEKS = 4;
    /** {@code usesPerWeek} is always this many ISO weeks, oldest -> newest, independent of the
     *  selected board period (contract: "Fixed length 12 ... Not enforced by the schema"). */
    private static final int TREND_WEEKS = 12;

    private final AdminProperties properties;
    private final AdminTableCatalog catalog;
    private final AdminInsightsQuery insightsQuery;
    private final AdminFeatureQuery featureQuery;
    private final LlmLogRepository llmLogRepository;
    private final CompanionFeatureFlag companionFeatureFlag;
    private final AppUserRepository appUserRepository;

    /** Funnel/unknown-key window (mezo-l096.4 ruling: fixed 90d, independent of the endpoint's
     *  {@code period} selector). */
    private static final int FUNNEL_WINDOW_DAYS = 90;

    /** {@code GET /api/admin/features} — feature scorecard (mezo-l096.3).
     *
     * <p>Row set = union of every {@code mezo.admin.feature-map} domain key and every distinct
     * {@code feature} slug seen in {@code llm_log_history} in the period (plan ruling). {@code
     * kind} is {@code system} for {@link LlmCallContext#UNKNOWN}'s slug and {@link
     * LlmCallContext#FEATURE_ADMIN_REPLAY} regardless of which sources saw them, {@code both} when
     * a slug is both a domain key AND an LLM feature, {@code domain}/{@code ai} otherwise.
     *
     * <p>THREE separate {@code since}-style bounds are in play, not one:
     * <ul>
     *   <li>{@code since} (period-scoped, from the selected {@code period}=30d/90d) — feeds the
     *       period metrics: {@code uniqueUsers}, cost/unknownCalls, errorPct, p90 latency.</li>
     *   <li>{@code weeksFrom} (the Monday of the ISO week {@link #HABIT_WINDOW_WEEKS}-1 weeks
     *       back, i.e. a FIXED trailing 4-ISO-week window) — feeds the habit-share numerator.
     *       This window is always contained inside a 30d/90d {@code since}, so it is safe to
     *       reuse the domain/LLM queries already bounded by {@code since} and just additionally
     *       filter/aggregate on {@code weeksFrom} inside them.</li>
     *   <li>{@code trendFrom} (the Monday {@link #TREND_WEEKS}-1 weeks back, a FIXED trailing
     *       12-ISO-week window) — passed DIRECTLY as its own {@code since} bound to the
     *       day-matrix queries ({@code insightsQuery.countByDay}, {@code
     *       aggregateByFeatureAndDaySince}) that build {@code usesPerWeek}. This one can NOT be
     *       collapsed into the period {@code since}: {@code usesPerWeek} is contractually a
     *       FIXED 12-week trend regardless of the selected period, and 12 weeks is 84 days —
     *       wider than a {@code period=30d} selection's 30-day {@code since}. Reusing the
     *       period {@code since} for the day-matrix queries would silently truncate the
     *       sparkline's oldest 8 weeks to zero whenever an owner picks the 30-day view.</li>
     * </ul>
     *
     * <p><b>Row-set deviation:</b> because the {@code trendFrom}-bound day-matrix queries
     * ({@code aggregateByFeatureAndDaySince}) also seed new rows via {@code
     * acc.computeIfAbsent}, the actual row set is the union of every {@code feature-map}
     * domain key and every feature slug seen within the {@code trendFrom} 12-week window —
     * not merely "in the period" as stated above. A feature idle for the whole selected
     * period (e.g. the last 30d) but used at some point in the trailing 12 weeks still gets
     * a row: all period-scoped numbers (calls, cost, errorPct, uniqueUsers) are zero while
     * {@code usesPerWeek} carries a non-zero sparkline. This is a deliberate deviation from
     * "in the period" — it lets an owner see a feature's usage tail off toward zero instead
     * of the row vanishing abruptly once its last use falls outside the period.
     */
    @Transactional(readOnly = true)
    public AdminFeatureBoardResponse board(String period) {
        featureQuery.applyStatementTimeout(properties.statementTimeoutSql());
        int days = AdminUsageService.periodDays(period);
        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);
        LocalDate periodFrom = today.minusDays(days - 1L);
        Instant since = periodFrom.atStartOfDay(zone).toInstant();
        LocalDate weeksFrom = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(HABIT_WINDOW_WEEKS - 1L);
        LocalDate trendFrom = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(TREND_WEEKS - 1L);
        List<LocalDate> weekStarts = new ArrayList<>();
        for (int i = 0; i < TREND_WEEKS; i++) {
            weekStarts.add(trendFrom.plusWeeks(i));
        }

        Map<String, FeatureAcc> acc = new LinkedHashMap<>();

        // ── domain side ──────────────────────────────────────────────────────────
        properties.featureMap().forEach((key, source) -> {
            FeatureAcc a = acc.computeIfAbsent(key, k -> new FeatureAcc());
            a.isDomain = true;
            AdminTable table = catalog.require(source.table());
            AdminColumn column = catalog.requireColumn(table, source.timestampColumn());
            for (DomainFeatureUserStatsRow row : featureQuery.domainFeatureUserStats(table, column, since, weeksFrom, zone)) {
                a.triedUsers.add(row.createdBy());
                a.calls += row.calls();
                if (row.activeWeeks().size() >= HABIT_MIN_WEEKS) {
                    a.habitUsers.add(row.createdBy());
                }
            }
            for (DayCountRow day : insightsQuery.countByDay(table, column, trendFrom, zone)) {
                a.addToWeek(weekStart(day.day()), day.count());
            }
        });

        // ── LLM side ─────────────────────────────────────────────────────────────
        for (LlmUserFeatureRow row : llmLogRepository.aggregateByUserAndFeatureSince(since, CallStatus.ERROR)) {
            FeatureAcc a = acc.computeIfAbsent(row.feature(), k -> new FeatureAcc());
            a.isLlm = true;
            if (row.userId() != null) {
                a.triedUsers.add(row.userId());
            }
            a.calls += row.calls();
            a.costUsd += row.costUsd() == null ? 0.0 : row.costUsd().doubleValue();
            a.unknownCalls += row.unknownCalls();
        }
        for (LlmFeatureUserActivityRow row : featureQuery.llmActiveWeeksByFeatureAndUser(since, zone, weeksFrom)) {
            FeatureAcc a = acc.computeIfAbsent(row.feature(), k -> new FeatureAcc());
            a.isLlm = true;
            if (row.activeWeeks().size() >= HABIT_MIN_WEEKS) {
                a.habitUsers.add(row.createdBy());
            }
        }
        for (LlmFeatureErrorRow row : llmLogRepository.aggregateErrorRateByFeatureSince(since)) {
            FeatureAcc a = acc.computeIfAbsent(row.getFeature(), k -> new FeatureAcc());
            a.isLlm = true;
            a.errorTotal = row.getTotal();
            a.errorErrors = row.getErrors();
        }
        for (LlmFeatureDayRow row : llmLogRepository.aggregateByFeatureAndDaySince(
                trendFrom.atStartOfDay(zone).toInstant(), zone.getId())) {
            FeatureAcc a = acc.computeIfAbsent(row.getFeature(), k -> new FeatureAcc());
            a.isLlm = true;
            a.addToWeek(weekStart(row.getDay()), row.getCalls());
        }
        Map<String, int[]> p90ByFeature = featureQuery.p90LatencyByFeature(since);
        for (String feature : p90ByFeature.keySet()) {
            acc.computeIfAbsent(feature, k -> new FeatureAcc()).isLlm = true;
        }

        // ── live feedback state (companion-gated; ruling: current state, not windowed) ─────────
        Set<String> mappedSlugs = new HashSet<>(properties.artifactFeatureMap().values());
        Map<String, int[]> helpedBySlug = new HashMap<>();
        if (companionFeatureFlag.enabled()) {
            for (FeedbackKindRow row : featureQuery.feedbackByFeature()) {
                String slug = properties.artifactFeatureMap().get(row.kind());
                if (slug == null) {
                    continue;
                }
                int[] counts = helpedBySlug.computeIfAbsent(slug, k -> new int[2]);
                if (MessageFeedbackVerdict.UP.equals(row.verdict())) {
                    counts[0] += row.count();
                } else if (MessageFeedbackVerdict.DOWN.equals(row.verdict())) {
                    counts[1] += row.count();
                }
            }
        }

        List<AdminFeatureRow> rows = new ArrayList<>();
        acc.forEach((key, a) -> {
            var row = new AdminFeatureRow();
            row.setKey(key);
            row.setKind(kindOf(key, a));
            row.setUniqueUsers((long) a.triedUsers.size());
            row.setUsesPerWeek(a.denseWeeks(weekStarts));
            row.setHabitUserShare(a.triedUsers.isEmpty() ? 0.0 : (double) a.habitUsers.size() / a.triedUsers.size());
            boolean mapped = companionFeatureFlag.enabled() && mappedSlugs.contains(key);
            row.setHelped(mapped ? helped(helpedBySlug.getOrDefault(key, new int[2])) : null);
            row.setAcceptedShare(null);
            row.setCostUsd(a.costUsd);
            row.setCostPerUse(a.calls == 0 ? null : a.costUsd / a.calls);
            row.setUnknownCalls(a.unknownCalls);
            row.setErrorPct(a.errorTotal == 0 ? null : a.errorErrors * 100.0 / a.errorTotal);
            int[] latency = p90ByFeature.get(key);
            row.setP90LatencyMs(latency == null ? null : latency[1]);
            row.setScreenViews(null);
            rows.add(row);
        });
        rows.sort(java.util.Comparator.comparing(AdminFeatureRow::getKey));

        return new AdminFeatureBoardResponse()
                .period(days + "d")
                .rows(rows);
    }

    private static AdminFeatureHelped helped(int[] counts) {
        return new AdminFeatureHelped().up(counts[0]).down(counts[1]);
    }

    private static KindEnum kindOf(String key, FeatureAcc a) {
        return KindEnum.valueOf(kindName(key, a.isDomain, a.isLlm));
    }

    /** Same {@code ai/domain/both/system} rule as {@link AdminFeatureRow#getKind}, but returned as
     *  a plain name — {@link AdminFeatureDetailResponse} generates its OWN nested {@code KindEnum}
     *  (same values, different Java type), so the shared logic can't return either enum directly. */
    private static String kindName(String key, boolean isDomain, boolean isLlm) {
        if ("unknown".equals(key) || LlmCallContext.FEATURE_ADMIN_REPLAY.equals(key)) {
            return "SYSTEM";
        }
        if (isDomain && isLlm) {
            return "BOTH";
        }
        return isDomain ? "DOMAIN" : "AI";
    }

    private static LocalDate weekStart(LocalDate day) {
        return day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /** Mirrors {@code MessageFeedbackEntity#VERDICT_UP}/{@code VERDICT_DOWN} — kept local to avoid
     *  an admin -> companion entity dependency for two string constants. */
    private static final class MessageFeedbackVerdict {
        static final String UP = "up";
        static final String DOWN = "down";
    }

    /** Per-feature accumulator threaded through {@link #board}'s domain + LLM passes. */
    private static final class FeatureAcc {
        boolean isDomain;
        boolean isLlm;
        final Set<UUID> triedUsers = new HashSet<>();
        final Set<UUID> habitUsers = new HashSet<>();
        long calls;
        double costUsd;
        long unknownCalls;
        long errorTotal;
        long errorErrors;
        final Map<LocalDate, Long> weekly = new HashMap<>();

        void addToWeek(LocalDate weekStart, long count) {
            weekly.merge(weekStart, count, Long::sum);
        }

        List<Integer> denseWeeks(List<LocalDate> weekStarts) {
            List<Integer> out = new ArrayList<>(weekStarts.size());
            for (LocalDate w : weekStarts) {
                out.add(weekly.getOrDefault(w, 0L).intValue());
            }
            return out;
        }
    }

    /**
     * {@code GET /api/admin/features/{key}} — one feature's detail (mezo-l096.4).
     *
     * <p>Two windows, same split as {@link #board}, minus the trend one collapsed to a single key:
     * <ul>
     *   <li>{@code since} (period-scoped) feeds {@code reliability}, {@code costByModel},
     *       {@code topUsers} and {@code feedbackTrend} — all "how has this been doing lately"
     *       panels.</li>
     *   <li>{@code funnelSince} (a FIXED trailing {@link #FUNNEL_WINDOW_DAYS}-day window,
     *       independent of the selected {@code period} — plan ruling) feeds {@code funnel} and the
     *       unknown-key existence check. {@code weeksFrom} (trailing {@link #HABIT_WINDOW_WEEKS}
     *       ISO weeks off today) feeds the habit sub-rule inside it, same as {@code board}.</li>
     *   <li>{@code trendFrom} (the fixed {@link #TREND_WEEKS}-week window) feeds
     *       {@code usageByWeek}, same fixed-length contract as {@code board}'s {@code usesPerWeek}.</li>
     * </ul>
     *
     * <p>{@code helped}-style feedback panels ({@code feedbackTrend}, {@code downReasons}) are
     * {@code null} when the companion switch is off, and an empty list (not null) when the switch
     * is on but this key has no {@code mezo.admin.artifact-feature-map} entry mapping to it.
     *
     * @throws SystemRuntimeErrorException 404 {@code ADMIN_FEATURE_NOT_FOUND} when {@code key} is
     *     neither a domain feature-map key nor has ANY {@code llm_log_history} row in the fixed
     *     90-day funnel window
     */
    @Transactional(readOnly = true)
    public AdminFeatureDetailResponse detail(String key, String period) {
        featureQuery.applyStatementTimeout(properties.statementTimeoutSql());
        ZoneId zone = properties.reportZone();
        LocalDate today = LocalDate.now(zone);

        boolean isDomainKey = properties.featureMap().containsKey(key);
        LocalDate funnelFrom = today.minusDays(FUNNEL_WINDOW_DAYS - 1L);
        Instant funnelSince = funnelFrom.atStartOfDay(zone).toInstant();
        boolean hasLlmRows = llmLogRepository.existsByFeatureSince(key, funnelSince);
        if (!isDomainKey && !hasLlmRows) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("ADMIN_FEATURE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
        }

        int days = AdminUsageService.periodDays(period);
        LocalDate periodFrom = today.minusDays(days - 1L);
        Instant since = periodFrom.atStartOfDay(zone).toInstant();
        LocalDate weeksFrom = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(HABIT_WINDOW_WEEKS - 1L);
        LocalDate trendFrom = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(TREND_WEEKS - 1L);
        List<LocalDate> weekStarts = new ArrayList<>();
        for (int i = 0; i < TREND_WEEKS; i++) {
            weekStarts.add(trendFrom.plusWeeks(i));
        }

        AdminTable table = null;
        AdminColumn column = null;
        if (isDomainKey) {
            AdminProperties.FeatureSource source = properties.featureMap().get(key);
            table = catalog.require(source.table());
            column = catalog.requireColumn(table, source.timestampColumn());
        }

        // ── usageByWeek (fixed 12-ISO-week trend) ───────────────────────────────
        FeatureAcc weekAcc = new FeatureAcc();
        if (isDomainKey) {
            for (DayCountRow day : insightsQuery.countByDay(table, column, trendFrom, zone)) {
                weekAcc.addToWeek(weekStart(day.day()), day.count());
            }
        }
        for (LlmFeatureDayRow row : llmLogRepository.aggregateByFeatureAndDaySince(
                trendFrom.atStartOfDay(zone).toInstant(), zone.getId())) {
            if (key.equals(row.getFeature())) {
                weekAcc.addToWeek(weekStart(row.getDay()), row.getCalls());
            }
        }

        // ── funnel (fixed 90d window; habit sub-rule fixed 4-ISO-week window) ───
        Set<UUID> triedUsers = new LinkedHashSet<>();
        Set<UUID> repeatedUsers = new HashSet<>();
        Set<UUID> habitualUsers = new HashSet<>();
        if (isDomainKey) {
            for (DomainFeatureUserStatsRow row : featureQuery.domainFeatureUserStats(table, column, funnelSince, weeksFrom, zone)) {
                triedUsers.add(row.createdBy());
                if (!row.firstDay().equals(row.lastDay())) {
                    repeatedUsers.add(row.createdBy());
                }
                if (row.activeWeeks().size() >= HABIT_MIN_WEEKS) {
                    habitualUsers.add(row.createdBy());
                }
            }
        }
        for (LlmFeatureUserRow row : llmLogRepository.aggregateByFeatureAndUserSince(funnelSince, CallStatus.ERROR)) {
            if (!key.equals(row.feature()) || row.createdBy() == null) {
                continue;
            }
            triedUsers.add(row.createdBy());
            if (!row.firstAt().atZone(zone).toLocalDate().equals(row.lastAt().atZone(zone).toLocalDate())) {
                repeatedUsers.add(row.createdBy());
            }
        }
        for (LlmFeatureUserActivityRow row : featureQuery.llmActiveWeeksByFeatureAndUser(funnelSince, zone, weeksFrom)) {
            if (key.equals(row.feature()) && row.activeWeeks().size() >= HABIT_MIN_WEEKS) {
                habitualUsers.add(row.createdBy());
            }
        }
        Map<UUID, AppUserEntity> resolvedTriedUsers = appUserRepository.findAllById(triedUsers).stream()
                .collect(Collectors.toMap(AppUserEntity::getId, u -> u));
        List<String> triedUserNames = triedUsers.stream()
                .map(id -> userLabel(id, resolvedTriedUsers))
                .sorted()
                .toList();

        // ── feedback trend + down reasons (companion-gated, current-state reasons) ─
        List<AdminFeatureFeedbackPoint> feedbackTrend = null;
        List<AdminFeatureDownReason> downReasons = null;
        if (companionFeatureFlag.enabled()) {
            String mappedKind = properties.artifactFeatureMap().entrySet().stream()
                    .filter(e -> e.getValue().equals(key))
                    .map(Map.Entry::getKey)
                    .findFirst()
                    .orElse(null);
            if (mappedKind == null) {
                feedbackTrend = List.of();
                downReasons = List.of();
            } else {
                Map<String, int[]> upDownByWeek = new LinkedHashMap<>();
                for (FeedbackTrendRow row : featureQuery.feedbackTrendByKind(mappedKind, since, zone)) {
                    int[] counts = upDownByWeek.computeIfAbsent(row.week(), w -> new int[2]);
                    if (MessageFeedbackVerdict.UP.equals(row.verdict())) {
                        counts[0] += (int) row.count();
                    } else if (MessageFeedbackVerdict.DOWN.equals(row.verdict())) {
                        counts[1] += (int) row.count();
                    }
                }
                feedbackTrend = upDownByWeek.entrySet().stream()
                        .sorted(Map.Entry.comparingByKey())
                        .map(e -> new AdminFeatureFeedbackPoint().week(e.getKey()).up(e.getValue()[0]).down(e.getValue()[1]))
                        .toList();

                Map<String, Long> reasonCounts = new LinkedHashMap<>();
                for (FeedbackKindRow row : featureQuery.feedbackByFeature()) {
                    if (!mappedKind.equals(row.kind()) || !MessageFeedbackVerdict.DOWN.equals(row.verdict())
                            || row.reason() == null) {
                        continue;
                    }
                    reasonCounts.merge(row.reason(), row.count(), Long::sum);
                }
                downReasons = reasonCounts.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                        .map(e -> new AdminFeatureDownReason().reason(e.getKey()).count(e.getValue().intValue()))
                        .toList();
            }
        }

        // ── reliability ──────────────────────────────────────────────────────────
        AdminFeatureReliability reliability = new AdminFeatureReliability();
        int[] latency = featureQuery.p90LatencyByFeature(since).get(key);
        reliability.setP50LatencyMs(latency == null ? null : latency[0]);
        reliability.setP90LatencyMs(latency == null ? null : latency[1]);
        Long errorTotal = null;
        Long errorErrors = null;
        for (LlmFeatureErrorRow row : llmLogRepository.aggregateErrorRateByFeatureSince(since)) {
            if (key.equals(row.getFeature())) {
                errorTotal = row.getTotal();
                errorErrors = row.getErrors();
                break;
            }
        }
        reliability.setErrorPct(errorTotal == null || errorTotal == 0 ? null : errorErrors * 100.0 / errorTotal);
        reliability.setTopErrors(featureQuery.topErrorsByFeature(key, since).stream()
                .map(r -> new AdminFeatureTopError().code(r.code()).count((int) r.count()))
                .toList());

        // ── cost by model ────────────────────────────────────────────────────────
        List<AdminFeatureModelCost> costByModel = llmLogRepository
                .aggregateByModelForFeatureSince(since, key, CallStatus.ERROR).stream()
                .map(r -> new AdminFeatureModelCost()
                        .model(r.key())
                        .costUsd(r.costUsd() == null ? 0.0 : r.costUsd().doubleValue())
                        .calls(r.callCount()))
                .toList();

        // ── top users ────────────────────────────────────────────────────────────
        List<LlmUserFeatureRow> userRows = llmLogRepository.aggregateByUserAndFeatureSince(since, CallStatus.ERROR)
                .stream()
                .filter(r -> key.equals(r.feature()) && r.userId() != null)
                .toList();
        Map<UUID, AppUserEntity> resolvedTopUsers = appUserRepository
                .findAllById(userRows.stream().map(LlmUserFeatureRow::userId).toList()).stream()
                .collect(Collectors.toMap(AppUserEntity::getId, u -> u));
        List<AdminFeatureTopUser> topUsers = userRows.stream()
                .map(r -> new AdminFeatureTopUser()
                        .name(userLabel(r.userId(), resolvedTopUsers))
                        .costUsd(r.costUsd() == null ? 0.0 : r.costUsd().doubleValue())
                        .uses(r.calls()))
                .sorted(Comparator.comparingDouble(AdminFeatureTopUser::getCostUsd).reversed())
                .toList();

        return new AdminFeatureDetailResponse()
                .key(key)
                .kind(AdminFeatureDetailResponse.KindEnum.valueOf(kindName(key, isDomainKey, hasLlmRows)))
                .usageByWeek(weekAcc.denseWeeks(weekStarts))
                .funnel(new AdminFeatureFunnel()
                        .tried(triedUsers.size())
                        .repeated(repeatedUsers.size())
                        .habitual(habitualUsers.size())
                        .triedUsers(triedUserNames))
                .feedbackTrend(feedbackTrend)
                .downReasons(downReasons)
                .reliability(reliability)
                .costByModel(costByModel)
                .topUsers(topUsers);
    }

    /**
     * {@code GET /api/admin/feedback/summary} — per-feature feedback + recall totals
     * (mezo-l096.4). Both panels are companion-gated: switch off -> empty {@code features} and
     * {@code null} recall, still a 200. {@code features}/{@code reasons} use the same "current
     * state" live read as {@code board}'s {@code helped} (plan ruling), never a windowed count;
     * only {@code recall} is windowed by the selected {@code period}.
     */
    @Transactional(readOnly = true)
    public AdminFeedbackSummaryResponse feedbackSummary(String period) {
        featureQuery.applyStatementTimeout(properties.statementTimeoutSql());
        int days = AdminUsageService.periodDays(period);
        ZoneId zone = properties.reportZone();
        Instant since = LocalDate.now(zone).minusDays(days - 1L).atStartOfDay(zone).toInstant();

        List<AdminFeedbackFeatureSummary> features = List.of();
        AdminFeedbackRecall recall = null;
        if (companionFeatureFlag.enabled()) {
            Map<String, int[]> upDownBySlug = new LinkedHashMap<>();
            Map<String, Map<String, Long>> reasonsBySlug = new LinkedHashMap<>();
            for (FeedbackKindRow row : featureQuery.feedbackByFeature()) {
                String slug = properties.artifactFeatureMap().get(row.kind());
                if (slug == null) {
                    continue;
                }
                int[] counts = upDownBySlug.computeIfAbsent(slug, k -> new int[2]);
                if (MessageFeedbackVerdict.UP.equals(row.verdict())) {
                    counts[0] += (int) row.count();
                } else if (MessageFeedbackVerdict.DOWN.equals(row.verdict())) {
                    counts[1] += (int) row.count();
                    if (row.reason() != null) {
                        reasonsBySlug.computeIfAbsent(slug, k -> new LinkedHashMap<>())
                                .merge(row.reason(), row.count(), Long::sum);
                    }
                }
            }
            features = upDownBySlug.entrySet().stream()
                    .map(e -> new AdminFeedbackFeatureSummary()
                            .key(e.getKey())
                            .up(e.getValue()[0])
                            .down(e.getValue()[1])
                            .reasons(reasonsBySlug.getOrDefault(e.getKey(), Map.of()).entrySet().stream()
                                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                                    .map(r -> new AdminFeatureDownReason().reason(r.getKey()).count(r.getValue().intValue()))
                                    .toList()))
                    .sorted(Comparator.comparing(AdminFeedbackFeatureSummary::getKey))
                    .toList();

            Map<String, Long> recallTotals = featureQuery.recallFeedbackTotals(since);
            recall = new AdminFeedbackRecall()
                    .useful(recallTotals.getOrDefault("useful", 0L).intValue())
                    .irrelevant(recallTotals.getOrDefault("irrelevant", 0L).intValue())
                    .suppress(recallTotals.getOrDefault("suppress", 0L).intValue());
        }

        return new AdminFeedbackSummaryResponse()
                .period(days + "d")
                .features(features)
                .recall(recall);
    }

    /** Display label for a user id: name (or email if the name is blank) for a live account, the
     *  raw id as a string when the account no longer exists (mirrors
     *  {@code AdminUsageService#costMatrix}'s deleted-user fallback). */
    private static String userLabel(UUID userId, Map<UUID, AppUserEntity> resolved) {
        AppUserEntity account = resolved.get(userId);
        if (account == null) {
            return userId.toString();
        }
        return account.getName() != null && !account.getName().isBlank() ? account.getName() : account.getEmail();
    }
}
