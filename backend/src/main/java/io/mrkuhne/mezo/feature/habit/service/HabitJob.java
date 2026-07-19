package io.mrkuhne.mezo.feature.habit.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nightly habit close cron (bd mezo-d1jb): the lazy GET path closes past days for active users;
 * this backstops the rest. End-of-day metrics evaluate honestly (caffeine cutoff, kitchen close),
 * the remaining pending rows quietly miss. Per-user failures are isolated; the pass is idempotent.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.HABIT_SWITCH, FeaturesConfiguration.HABIT_JOB_SWITCH},
        havingValue = "true")
public class HabitJob {

    private final AppUserRepository appUserRepository;
    private final HabitService habitService;

    @Scheduled(cron = "${mezo.habit.close-cron}")
    public void runClose() {
        LocalDate today = LocalDate.now();
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                habitService.closePast(user.getId(), today);
            } catch (Exception e) {
                log.warn("Habit close failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Habit close run for {} complete", today);
    }
}
