package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.config.DayReviewWarmupProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * A napom S1 (spec 2026-09-24 §1): closes yesterday's review overnight so the morning read is a
 * cache hit instead of a synchronous LLM call. It adds no persistence of its own:
 * {@link DayReviewService#assemble} already hashes the day's inputs and upserts {@code day_review}
 * on a miss, so this job simply ASKS for every finished day in the catch-up window. A retroactive
 * log changes the hash, and the next run (or the next read) rewrites that review exactly once.
 * Per user × date failures are isolated: one bad day never stops the run.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
    name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.DAY_REVIEW_SWITCH,
        FeaturesConfiguration.DAY_REVIEW_WARMUP_JOB_SWITCH},
    havingValue = "true")
public class DayReviewWarmupJob {

    private final UserFanOut userFanOut;
    private final DayReviewService dayReviewService;
    private final DayReviewWarmupProperties properties;

    @Scheduled(cron = "${mezo.companion.day-review-warmup.cron}")
    public void run() {
        LocalDate yesterday = LocalDate.now().minusDays(1);
        LocalDate from = yesterday.minusDays(properties.catchUpDays() - 1L);
        userFanOut.forEachActiveUser("Day review warm-up", user -> {
            int warmed = 0;
            for (LocalDate date = yesterday; !date.isBefore(from); date = date.minusDays(1)) {
                try {
                    dayReviewService.assemble(user.getId(), date);
                    warmed++;
                } catch (Exception e) {
                    log.warn("Day review warm-up failed for user {} on {}", user.getId(), date, e);
                }
            }
            log.info("Day review warm-up for user {}: {} day(s) in {}..{}", user.getId(), warmed, from, yesterday);
        });
    }
}
