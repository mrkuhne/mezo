package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W5.1 hourly sweep (bd mezo-b3pp.18, spec §9.1) — the {@code PatternDetectionJob} idiom:
 * per-user isolation, one bad user never kills the run. The on-write listener covers the windows a
 * WRITE crosses; this job covers the ones TIME crosses on its own (a third quiet day arriving, a
 * cooldown expiring) — no write, so no event, so nothing else would notice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.FLAG_SWEEP_JOB_SWITCH},
        havingValue = "true")
public class FlagSweepJob {

    private final AppUserRepository appUserRepository;
    private final FlagService flagService;

    @Scheduled(cron = "${mezo.companion.flags.sweep-cron}")
    public void run() {
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                // FlagService.evaluateAndLog already logs the raised keys for both triggers — no
                // need to log again here.
                flagService.evaluateAndLog(user.getId(), FlagKey.SOURCE_SWEEP);
            } catch (Exception e) {
                log.warn("Flag sweep failed for user {}", user.getId(), e);
            }
        }
    }
}
