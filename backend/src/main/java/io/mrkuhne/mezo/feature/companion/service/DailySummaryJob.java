package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.embedding.MemoryEmbeddingWriter;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.ZoneId;

/**
 * The V2.2 nightly narrative-memory job — the app's first {@code @Scheduled} cron. For every
 * user and every FINISHED day in the catch-up window it (a) generates the missing
 * {@code daily_summary} (idempotent — an existing day is returned, not regenerated) and (b)
 * embeds it; then (c) catch-up-embeds any chat turns still missing their vector (covers
 * listener-off periods, crashes, and pre-V2.2 history). Per-date failures are isolated: one
 * bad day must never kill the run — the next night retries it via the same catch-up.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.DAILY_SUMMARY_JOB_SWITCH},
        havingValue = "true")
public class DailySummaryJob {

    private final AppUserRepository appUserRepository;
    private final DailySummaryService dailySummaryService;
    private final MemoryEmbeddingWriter memoryEmbeddingWriter;
    private final CompanionProperties properties;

    @Scheduled(cron = "${mezo.companion.summary.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate from = yesterday.minusDays(properties.summary().catchUpDays() - 1L);
        for (AppUserEntity user : appUserRepository.findAll()) {
            int generated = 0;
            for (LocalDate date = from; !date.isAfter(yesterday); date = date.plusDays(1)) {
                try {
                    DailySummaryEntity summary = dailySummaryService.generate(user.getId(), date);
                    if (summary != null) {
                        memoryEmbeddingWriter.writeSummary(summary);
                        generated++;
                    }
                } catch (Exception e) {
                    log.warn("Daily summary failed for user {} on {}", user.getId(), date, e);
                }
            }
            try {
                memoryEmbeddingWriter.catchUpTurns(user.getId(),
                        from.atStartOfDay(ZoneId.systemDefault()).toInstant());
            } catch (Exception e) {
                log.warn("Turn-embedding catch-up failed for user {}", user.getId(), e);
            }
            log.info("Daily-summary run for user {}: {} day(s) processed in window {}..{}",
                    user.getId(), generated, from, yesterday);
        }
    }
}
