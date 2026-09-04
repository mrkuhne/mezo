package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Monday adaptive-review sweep (diet-plan slice 5) — the {@code WeeklyReviewJob} idiom: per-user
 * failures isolated, idempotent (AdaptiveReviewService skips an already-reviewed week), the bean
 * absent when the switch is off. Suggest + approve: the job only ever proposes.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADAPTIVE_REVIEW_JOB_SWITCH, havingValue = "true")
public class AdaptiveReviewJob {

    private final AppUserRepository appUserRepository;
    private final AdaptiveReviewService adaptiveReviewService;

    @Scheduled(cron = "${mezo.goal.adaptive.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int proposed = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (adaptiveReviewService.reviewUser(user.getId(), weekStart)) {
                    proposed++;
                }
            } catch (Exception e) {
                log.warn("Adaptive review failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Adaptive-review run for {}: {} correction(s) proposed", weekStart, proposed);
    }
}
