package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;

/**
 * W3.2 consolidation ladder cron (bd mezo-b3pp.13, spec §7.2) — the {@link DailySummaryJob} idiom
 * one rung up: generate the missing rungs of the backfill window and embed each, per user, with
 * per-user AND per-period isolation (one bad period must never kill the run; the next run retries
 * it through the same idempotent catch-up).
 *
 * <p>Two schedules, both in the dawn dead zone: the WEEKLY rung runs Monday 03:30 — after that
 * dawn's 02:20 daily summaries, so the just-finished week is already complete at the day level —
 * and the MONTHLY rung on the 1st at 03:50, after the weekly rung of the same dawn, because a
 * month is condensed from its weeks. Only FINISHED periods are consolidated: the newest week the
 * job ever touches is the one that ended yesterday-ish, never the running one.
 *
 * <p>The embed hop is re-offered for existing rungs too — that is the self-heal for a rung whose
 * vector never landed; {@link MemoryEmbeddingWriter#writePeriodSummary} short-circuits when the
 * text is unchanged, so a healthy backfill window costs no provider calls.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.CONSOLIDATION_JOB_SWITCH},
        havingValue = "true")
public class ConsolidationJob {

    private final UserFanOut userFanOut;
    private final PeriodSummaryService periodSummaryService;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;

    @Scheduled(cron = "${mezo.companion.consolidation.weekly-cron}")
    public void runWeekly() {
        LocalDate lastFinishedWeek = LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(1);
        int weeks = properties.consolidation().backfillWeeks();
        userFanOut.forEachActiveUser("Weekly consolidation", user -> {
            int generated = 0;
            for (int i = 0; i < weeks; i++) {
                LocalDate weekStart = lastFinishedWeek.minusWeeks(i);
                if (consolidate(user.getId(), weekStart, true)) {
                    generated++;
                }
            }
            log.info("Weekly consolidation for user {}: {} rung(s) present in window {}..{}",
                    user.getId(), generated, lastFinishedWeek.minusWeeks(weeks - 1L), lastFinishedWeek);
        });
    }

    @Scheduled(cron = "${mezo.companion.consolidation.monthly-cron}")
    public void runMonthly() {
        LocalDate lastFinishedMonth = LocalDate.now().withDayOfMonth(1).minusMonths(1);
        int months = properties.consolidation().backfillMonths();
        userFanOut.forEachActiveUser("Monthly consolidation", user -> {
            int generated = 0;
            for (int i = 0; i < months; i++) {
                LocalDate monthStart = lastFinishedMonth.minusMonths(i);
                if (consolidate(user.getId(), monthStart, false)) {
                    generated++;
                }
            }
            log.info("Monthly consolidation for user {}: {} rung(s) present in window {}..{}",
                    user.getId(), generated, lastFinishedMonth.minusMonths(months - 1L), lastFinishedMonth);
        });
    }

    /** One period: generate-or-return + embed. Returns whether a rung exists for it afterwards. */
    private boolean consolidate(UUID userId, LocalDate periodStart, boolean weekly) {
        try {
            PeriodSummaryEntity rung = weekly
                    ? periodSummaryService.generateWeek(userId, periodStart)
                    : periodSummaryService.generateMonth(userId, periodStart);
            if (rung == null) {
                return false;
            }
            memoryEmbeddingWriter.writePeriodSummary(rung);
            return true;
        } catch (Exception e) {
            log.warn("Consolidation failed for user {} period {} (weekly={})",
                    userId, periodStart, weekly, e);
            return false;
        }
    }
}
