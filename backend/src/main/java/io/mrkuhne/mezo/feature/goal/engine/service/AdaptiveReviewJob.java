package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.goal.service.ExpenditureWeekLearnedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.DayOfWeek;
import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Monday adaptive-review sweep (diet-plan slice 5) — the {@code WeeklyReviewJob} idiom: per-user
 * failures isolated, idempotent (AdaptiveReviewService skips an already-reviewed week; the learned
 * path stays idempotent via {@code expenditure_estimate}'s per-week upsert), the bean absent when
 * the switch is off. Per user: {@link ExpenditureLearningService#reviewWeek} is tried first for the
 * week that just ended; a learning user (a row comes back, HOLDING included) never also gets the
 * weight-only {@code weekly_correction} suggestion — owner decision L4, the two are exclusive. Only
 * a non-learning user (empty) falls back to the old suggest-only path,
 * {@link AdaptiveReviewService#reviewUser}. With the owner's learning switch off (mezo-3n2so, owner
 * decision P3) the learning still runs silently — the row is written, the learned base is not
 * served — and the user gets the weight-only suggestion as a non-learner would.
 *
 * <p>Task 6 (mezo-3n2so): a present, worth-saying row ({@link WeeklyCardPolicy#worthSaying})
 * with the switch on also publishes {@link ExpenditureWeekLearnedEvent} — the Monday bell. Only
 * this job publishes it; {@code ExpenditureRolloutRunner} and {@code IntakeDayMarkService} call
 * {@code ExpenditureLearningService} directly and never ring it.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.ADAPTIVE_REVIEW_JOB_SWITCH, havingValue = "true")
public class AdaptiveReviewJob {

    private final AppUserRepository appUserRepository;
    private final AdaptiveReviewService adaptiveReviewService;
    private final ExpenditureLearningService expenditureLearning;
    private final DietPreferencesPort dietPreferences;
    private final ApplicationEventPublisher eventPublisher;

    @Scheduled(cron = "${mezo.goal.adaptive.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int learned = 0;
        int proposed = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                boolean enabled = dietPreferences.resolve(user.getId()).learningEnabled();
                Optional<ExpenditureEstimateEntity> row =
                    expenditureLearning.reviewWeek(user.getId(), weekStart.minusWeeks(1));
                if (row.isPresent()) {
                    learned++;
                    if (enabled && WeeklyCardPolicy.worthSaying(row.get())) {
                        ExpenditureEstimateEntity r = row.get();
                        eventPublisher.publishEvent(new ExpenditureWeekLearnedEvent(
                            user.getId(), r.getId(), r.getWeekStart(), r.getStatus(),
                            r.getStepKcal(), r.getExcludedDays().size()));
                    }
                }
                if ((row.isEmpty() || !enabled) && adaptiveReviewService.reviewUser(user.getId(), weekStart)) {
                    proposed++;
                }
            } catch (Exception e) {
                log.warn("Adaptive review failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Weekly energy review for {}: {} learned, {} correction(s) proposed", weekStart, learned, proposed);
    }
}
