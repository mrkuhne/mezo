package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.HeartbeatNoteEntity;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The H1 window crons: midday nudge + evening closing (config, proactive.md §9 decision p).
 * Today-only, no backfill (a past window is never read — the lazy GET is the miss-recovery);
 * idempotent; per-user failures isolated (the MemoirJob idiom).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.HEARTBEAT_JOB_SWITCH},
        havingValue = "true")
public class HeartbeatJob {

    private final AppUserRepository appUserRepository;
    private final HeartbeatGenerator generator;

    @Scheduled(cron = "${mezo.proactive.heartbeat.midday-cron}")
    public void runMidday() {
        run(HeartbeatNoteEntity.WINDOW_MIDDAY);
    }

    @Scheduled(cron = "${mezo.proactive.heartbeat.evening-cron}")
    public void runEvening() {
        run(HeartbeatNoteEntity.WINDOW_EVENING);
    }

    private void run(String windowKey) {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (generator.generate(user.getId(), today, windowKey) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Heartbeat generation failed for user {} day {} window {}",
                        user.getId(), today, windowKey, e);
            }
        }
        log.info("Heartbeat {} run for {}: {} note(s) present", windowKey, today, generated);
    }
}
