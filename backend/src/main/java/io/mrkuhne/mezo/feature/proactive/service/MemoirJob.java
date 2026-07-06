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
 * W2 Sunday-evening memoir generation: the memoir for the week ENDING this Sunday per user
 * (the ISO-Monday of the current week). Idempotent; per-user failures isolated; the lazy GET
 * covers misses (last completed week).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.MEMOIR_JOB_SWITCH},
        havingValue = "true")
public class MemoirJob {

    private final AppUserRepository appUserRepository;
    private final MemoirGenerator generator;

    @Scheduled(cron = "${mezo.proactive.memoir.cron}")
    public void run() {
        LocalDate weekStart = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (generator.generate(user.getId(), weekStart) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Memoir generation failed for user {} week {}", user.getId(), weekStart, e);
            }
        }
        log.info("Memoir run for {}: {} memoir(s) present", weekStart, generated);
    }
}
