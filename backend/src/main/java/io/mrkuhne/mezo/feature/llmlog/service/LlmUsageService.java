package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.api.dto.LlmUsagePeriod;
import io.mrkuhne.mezo.api.dto.LlmUsageSummaryResponse;
import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.config.LlmPricingProperties;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmUsageAggregate;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
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
        LocalDate today = LocalDate.now(zone);
        return LlmUsageSummaryResponse.builder()
            .day(period(today, zone))
            .week(period(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), zone))
            .month(period(today.withDayOfMonth(1), zone))
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

    /** null stays null — no priced row in the period means "cost unknown", never a confident 0. */
    private Double toDouble(BigDecimal costUsd) {
        return costUsd == null ? null : costUsd.doubleValue();
    }
}
