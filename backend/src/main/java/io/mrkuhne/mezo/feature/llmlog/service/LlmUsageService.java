package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.api.dto.LlmCallDetailResponse;
import io.mrkuhne.mezo.api.dto.LlmCallListItem;
import io.mrkuhne.mezo.api.dto.LlmCallListResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageBreakdownResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageGroup;
import io.mrkuhne.mezo.api.dto.LlmUsagePeriod;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.api.dto.LlmUsageTotals;
import io.mrkuhne.mezo.api.dto.LlmUsageUserGroup;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.config.LlmPricingProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.CallStatus;
import io.mrkuhne.mezo.feature.llmlog.mapper.LlmLogMapper;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmCallRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmDailyAggregate;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmGroupRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmStatusRow;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUsageAggregate;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUserRow;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Day / week / month rollups over the {@code llm_log_history} audit table (mezo-h3gb).
 *
 * <p>The three periods are CALENDAR periods in {@link LlmLogProperties#reportZone()} — start of
 * today, start of this ISO week (Monday), start of this month — not rolling 24h/7d/30d windows.
 * They therefore nest: every call in "today" is also in "this week" and "this month".
 *
 * <p>Reads the whole table, not the caller's slice: cron- and async-written rows have a null
 * {@code created_by}, so an ownership filter would hide exactly the volume that costs the most.
 * Since mezo-qw37.3 the surface is OWNER-only (the controller gates it) and the per-account split
 * is reported explicitly via {@code byUser}.
 */
@Service
@RequiredArgsConstructor
public class LlmUsageService {

    /** The list window's default and hard ceiling — mirrored by the contract's min/max/default. */
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 500;

    private final LlmLogRepository llmLogRepository;
    private final LlmLogProperties llmLogProperties;
    private final LlmPricingProperties llmPricingProperties;
    private final LlmLogMapper llmLogMapper;
    private final ObjectProvider<EventPublishingLlmCallRecorder> auditRecorder;

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
            .byUser(userGroups(llmLogRepository.aggregateByUserSince(since)))
            .build();
    }

    /**
     * The browsable audit list (mezo-uakh). {@code limit} is a GROWING WINDOW, not a page offset:
     * the client raises it to see more, so every response is one consistent read from the top of
     * the log and rows can neither duplicate nor be skipped as new calls arrive.
     */
    @Transactional(readOnly = true)
    public LlmCallListResponse listCalls(String rawPeriod, String feature, String rawStatus,
                                         String rawCallKind, UUID userId, Integer rawLimit) {
        ZoneId zone = llmLogProperties.reportZone();
        Instant since = UsagePeriod.parse(rawPeriod).startDate(zone).atStartOfDay(zone).toInstant();
        int limit = Math.clamp(rawLimit == null ? DEFAULT_LIMIT : rawLimit, 1, MAX_LIMIT);

        List<LlmCallRow> rows = llmLogRepository.findCalls(
            since,
            blankToNull(feature),
            parseEnum(rawStatus, CallStatus::valueOf, "status"),
            parseEnum(rawCallKind, CallKind::valueOf, "callKind"),
            userId,
            PageRequest.of(0, limit + 1));

        boolean hasMore = rows.size() > limit;
        return LlmCallListResponse.builder()
            .items(rows.stream().limit(limit).map(this::toListItem).toList())
            .hasMore(hasMore)
            .build();
    }

    /**
     * One audited call in full (mezo-uakh) — the only read that returns the verbatim payload.
     * No ownership check: the surface is owner-gated (requireOwner(), since mezo-qw37.3) and the
     * rows are deliberately unfiltered — the log has rows with no owner at all (cron/stream),
     * whose createdBy is null.
     */
    @Transactional(readOnly = true)
    public LlmCallDetailResponse call(UUID id) {
        return llmLogRepository.findById(id)
            .map(llmLogMapper::toDetail)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("LLM_LOG_CALL_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    private LlmCallListItem toListItem(LlmCallRow row) {
        return LlmCallListItem.builder()
            .id(row.id())
            .createdBy(row.createdBy())
            .createdAt(row.createdAt().atOffset(ZoneOffset.UTC))
            .feature(row.feature())
            .operation(row.operation())
            .callKind(LlmCallListItem.CallKindEnum.fromValue(row.callKind().name()))
            .status(LlmCallListItem.StatusEnum.fromValue(row.status().name()))
            .requestedModel(row.requestedModel())
            .servedModel(row.servedModel())
            .latencyMs(row.latencyMs())
            .streamed(row.streamed())
            .toolRounds(row.toolRounds())
            .totalTokens(row.totalTokens())
            .imageCount(row.imageCount())
            .embedInputCount(row.embedInputCount())
            .embedDimensions(row.embedDimensions())
            .costUsd(toDouble(row.costUsd()))
            .errorClass(row.errorClass())
            .errorCode(row.errorCode())
            .build();
    }

    /** An unknown filter value is a client error (400), not a 500 — see UsagePeriod's javadoc. */
    private static <E> E parseEnum(String raw, Function<String, E> factory, String field) {
        String value = blankToNull(raw);
        if (value == null) {
            return null;
        }
        try {
            return factory.apply(value);
        } catch (IllegalArgumentException ex) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", field).build());
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
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

    /** Same ordering rule as {@link #groups}: cost-descending, unpriced last, then call count. */
    private List<LlmUsageUserGroup> userGroups(List<LlmUserRow> rows) {
        return rows.stream()
            .sorted(Comparator
                .comparing(LlmUserRow::costUsd, Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Comparator.comparingLong(LlmUserRow::callCount).reversed()))
            .map(r -> LlmUsageUserGroup.builder()
                .userId(r.userId())
                .name(r.name())
                .callCount(r.callCount())
                .totalTokens(r.totalTokens())
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

    /** Az audit-kapcsoló állása — a recorder bean jelenléte MAGA a kapcsoló (nincs @Value). */
    public boolean auditEnabled() {
        return auditRecorder.getIfAvailable() != null;
    }

    /**
     * Az utolsó {@code days} naptári nap (a maival bezárólag) napi rollupja, date-asc, egy accountra
     * szűkítve (mezo-qw37.7) — a Memória/Audit panel csak a saját hívásait látja; a
     * {@code created_by IS NULL} sorok (cron/stream) senkihez sem tartoznak, ezért kimaradnak.
     */
    @Transactional(readOnly = true)
    public List<LlmDailyAggregate> perDay(UUID userId, int days) {
        ZoneId zone = llmLogProperties.reportZone();
        Instant since = LocalDate.now(zone).minusDays(days - 1L).atStartOfDay(zone).toInstant();
        return llmLogRepository.aggregatePerDaySinceForUser(since, zone.getId(), userId);
    }
}
