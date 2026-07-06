package io.mrkuhne.mezo.feature.proactive.service;

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
 * B1.2 dawn pre-generation (spec §2 hybrid model): TODAY's briefing per user, before the
 * typical wake. Deliberately NO multi-day backfill — a past morning's briefing is never read,
 * and the lazy GET (B1.1) covers a missed run. Idempotent (generate returns an existing row
 * untouched); per-user failures are isolated so one bad user never kills the run.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.BRIEFING_JOB_SWITCH},
        havingValue = "true")
public class BriefingJob {

    private final AppUserRepository appUserRepository;
    private final BriefingGenerator briefingGenerator;

    @Scheduled(cron = "${mezo.proactive.briefing.cron}")
    public void run() {
        LocalDate today = LocalDate.now();
        int generated = 0;
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                if (briefingGenerator.generate(user.getId(), today) != null) {
                    generated++;
                }
            } catch (Exception e) {
                log.warn("Briefing pre-generation failed for user {} on {}", user.getId(), today, e);
            }
        }
        log.info("Briefing dawn run for {}: {} briefing(s) present", today, generated);
    }
}
