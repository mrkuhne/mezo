package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageGroup;
import io.mrkuhne.mezo.api.dto.LlmUsagePeriod;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageTotals;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.config.LlmPricingProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmGroupRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmStatusRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUsageAggregate;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Day / week / month rollups over the {@code llm_log_history} audit table (mezo-h3gb).
 *
 * <p>The three periods are CALENDAR periods in {@link LlmLogProperties#reportZone()} — start of
 * today, start of this ISO week (Monday), start of this month — not rolling 24h/7d/30d windows.
 * They therefore nest: every call in "today" is also in "this week" and "this month".
 *
 * <p>Reads the whole table, not the current user's slice: cron- and async-written rows have a null
 * {@code created_by}, so an ownership filter would hide exactly the volume that costs the most.
 * The endpoint is single-user and behind JWT auth, so "all rows" IS "my rows".
 */
@Service
@RequiredArgsConstructor
public class LlmUsageService {

    private final LlmLogRepository llmLogRepository;
    private final LlmLogProperties llmLogProperties;
    private final LlmPricingProperties llmPricingProperties;

    /**
     * Read-only transaction so the three period aggregates share ONE snapshot: without it a call
     * logged between the month query and the day query could report {@code day > month}.
     */
    @Transactional(readOnly = true)
    public LlmUsageSummaryResponse summary() {
        ZoneId zone = llmLogProperties.reportZone();
        return LlmUsageSummaryResponse.builder()
            .day(period(UsagePeriod.DAY.startDate(zone), zone))
            .week(period(UsagePeriod.WEEK.startDate(zone), zone))
            .month(period(UsagePeriod.MONTH.startDate(zone), zone))
            .build();
    }

    /**
     * The AI-napló header (mezo-uakh): totals plus the feature and served-model rollups for ONE
     * calendar period. Same read-only-transaction reasoning as {@link #summary()} — the three
     * queries must see one snapshot or the buckets would not add up to the totals.
     */
    @Transactional(readOnly = true)
    public LlmUsageBreakdownResponse breakdown(String rawPeriod) {
        ZoneId zone = llmLogProperties.reportZone();
        LocalDate from = UsagePeriod.parse(rawPeriod).startDate(zone);
        Instant since = from.atStartOfDay(zone).toInstant();

        return LlmUsageBreakdownResponse.builder()
            .from(from)
            .totals(totals(llmLogRepository.aggregateByStatusSince(since)))
            .features(groups(llmLogRepository.aggregateByFeatureSince(since)))
            .models(groups(llmLogRepository.aggregateByModelSince(since)))
            .build();
    }

    /** Rolls up everything logged since the start of {@code from} — {@code atStartOfDay} is DST-safe. */
    private LlmUsagePeriod period(LocalDate from, ZoneId zone) {
        LlmUsageAggregate aggregate = llmLogRepository.aggregateSince(from.atStartOfDay(zone).toInstant());
        return LlmUsagePeriod.builder()
            .callCount(aggregate.callCount())
            .costUsd(toDouble(aggregate.costUsd()))
            .currency(llmPricingProperties.currency())
            .build();
    }

    /** Folds the per-status rows into one totals block; a missing status is simply zero. */
    private LlmUsageTotals totals(List<LlmStatusRow> rows) {
        return LlmUsageTotals.builder()
            .callCount(rows.stream().mapToLong(LlmStatusRow::callCount).sum())
            .successCount(countOf(rows, CallStatus.SUCCESS))
            .errorCount(countOf(rows, CallStatus.ERROR))
            .cancelledCount(countOf(rows, CallStatus.CANCELLED))
            .unpricedCount(rows.stream().mapToLong(LlmStatusRow::unpricedCount).sum())
            .costUsd(toDouble(sumCost(rows.stream().map(LlmStatusRow::costUsd).toList())))
            .currency(llmPricingProperties.currency())
            .build();
    }

    /**
     * Cost-descending, unpriced last, ties broken by call count.
     *
     * <p>Sorted in Java rather than with an HQL {@code order by … nulls last}: the ordering has to
     * express "unknown cost sorts last", the buckets are a handful of rows (one per feature slug),
     * and doing it here keeps the comparator readable and dialect-independent.
     */
    private List<LlmUsageGroup> groups(List<LlmGroupRow> rows) {
        return rows.stream()
            .sorted(Comparator
                .comparing(LlmGroupRow::costUsd, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Comparator.comparingLong(LlmGroupRow::callCount).reversed()))
            .map(r -> LlmUsageGroup.builder()
                .key(r.key())
                .callCount(r.callCount())
                .costUsd(toDouble(r.costUsd()))
                .build())
            .toList();
    }

    private static long countOf(List<LlmStatusRow> rows, CallStatus status) {
        return rows.stream().filter(r -> r.status() == status).mapToLong(LlmStatusRow::callCount).sum();
    }

    /** null + null stays null; any priced row makes the sum a number. */
    private static BigDecimal sumCost(List<BigDecimal> costs) {
        return costs.stream().filter(Objects::nonNull)
            .reduce(BigDecimal::add)
            .orElse(null);
    }

    /** null stays null — no priced row in the period means "cost unknown", never a confident 0. */
    private Double toDouble(BigDecimal costUsd) {
        return costUsd == null ? null : costUsd.doubleValue();
    }
}
