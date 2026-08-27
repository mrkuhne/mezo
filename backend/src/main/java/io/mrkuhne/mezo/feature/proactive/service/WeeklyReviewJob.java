package io.mrkuhne.mezo.feature.proactive.service;

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
 * Monday weekly-review pre-generation (mezo-p2tr): the {@code WeeklySuggestionJob} idiom applied
 * BACKWARD — this generates the review for the week that JUST FINISHED
 * ({@code weekStart = previousOrSame(MONDAY).minusWeeks(1)}), unlike {@link WeeklySuggestionJob}'s
 * forward-looking CURRENT week. Idempotent (existing rows are returned untouched); per-user
 * failures isolated; the lazy GET covers misses.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.WEEKLY_REVIEW_JOB_SWITCH},
        havingValue = "true")
public class WeeklyReviewJob {

    private final AppUserRepository appUserRepository;
    private final WeeklyReviewGenerator generator;

    @Scheduled(cron = "${mezo.proactive.weekly-review.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .minusWeeks(1);
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (generator.generate(user.getId(), weekStart) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Weekly review failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Weekly-review run for {}: {} review(s) present", weekStart, generated);
    }
}
