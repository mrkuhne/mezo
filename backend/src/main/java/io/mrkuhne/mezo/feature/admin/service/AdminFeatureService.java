package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminFeatureBoardResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureDetailResponse;
import io.mrkuhne.mezo.api.dto.AdminFeatureFunnel;
import io.mrkuhne.mezo.api.dto.AdminFeatureHelped;
import io.mrkuhne.mezo.api.dto.AdminFeatureReliability;
import io.mrkuhne.mezo.api.dto.AdminFeatureRow;
import io.mrkuhne.mezo.api.dto.AdminFeatureRow.KindEnum;
import io.mrkuhne.mezo.api.dto.AdminFeedbackSummaryResponse;
import io.mrkuhne.mezo.feature.admin.config.AdminProperties;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.DomainFeatureUserStatsRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.FeedbackKindRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminFeatureQuery.LlmFeatureUserActivityRow;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery;
import io.mrkuhne.mezo.feature.admin.repository.AdminInsightsQuery.DayCountRow;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminColumn;
import io.mrkuhne.mezo.feature.admin.service.AdminTableCatalog.AdminTable;
import io.mrkuhne.mezo.feature.companion.config.CompanionFeatureFlag;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureDayRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmFeatureErrorRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUserFeatureRow;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
        if ("unknown".equals(key) || LlmCallContext.FEATURE_ADMIN_REPLAY.equals(key)) {
            return KindEnum.SYSTEM;
        }
        if (a.isDomain && a.isLlm) {
            return KindEnum.BOTH;
        }
        return a.isDomain ? KindEnum.DOMAIN : KindEnum.AI;
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

    /** {@code GET /api/admin/features/{key}} — one feature's detail (mezo-l096.4). Skeleton:
     *  null-filled response regardless of {@code key}/{@code period} — the unknown-key 404 is
     *  wired in Task 4 alongside the real lookup. */
    public AdminFeatureDetailResponse detail(String key, String period) {
        return new AdminFeatureDetailResponse()
                .key(key)
                .usageByWeek(List.of())
                .funnel(new AdminFeatureFunnel()
                        .tried(0)
                        .repeated(0)
                        .habitual(0)
                        .triedUsers(List.of()))
                .feedbackTrend(null)
                .downReasons(null)
                .reliability(new AdminFeatureReliability()
                        .errorPct(null)
                        .p90LatencyMs(null)
                        .p50LatencyMs(null)
                        .topErrors(List.of()))
                .costByModel(List.of())
                .topUsers(List.of());
    }

    /** {@code GET /api/admin/feedback/summary} — per-feature feedback + recall totals
     *  (mezo-l096.4). Skeleton: empty features, null recall regardless of {@code period}. */
    public AdminFeedbackSummaryResponse feedbackSummary(String period) {
        return new AdminFeedbackSummaryResponse()
                .period(period)
                .features(List.of())
                .recall(null);
    }
}
