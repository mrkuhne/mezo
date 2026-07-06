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
 * W1 Monday-dawn pre-generation: the CURRENT week's suggestion per user (gathered from the
 * finished previous week). Idempotent; per-user failures isolated; the lazy GET covers misses.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.WEEKLY_SUGGESTION_JOB_SWITCH},
        havingValue = "true")
public class WeeklySuggestionJob {

    private final AppUserRepository appUserRepository;
    private final WeeklySuggestionGenerator generator;

    @Scheduled(cron = "${mezo.proactive.weekly.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (generator.generate(user.getId(), weekStart) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Weekly suggestion failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Weekly-suggestion run for {}: {} suggestion(s) present", weekStart, generated);
    }
}
