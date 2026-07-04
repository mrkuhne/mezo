package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The V3.2 weekly hypothesis cron (Sunday small-hours by default — after the nightly jobs).
 * Per-user isolation, the V2.2/V3.1 idiom; the pipeline itself is defensive per hypothesis.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.HYPOTHESIS_JOB_SWITCH},
        havingValue = "true")
public class HypothesisJob {

    private final AppUserRepository appUserRepository;
    private final HypothesisPipelineService hypothesisPipelineService;

    @Scheduled(cron = "${mezo.companion.hypotheses.cron}")
    public void run() {
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                int persisted = hypothesisPipelineService.run(user.getId());
                log.info("Hypothesis round for user {}: {} survivor(s) persisted", user.getId(), persisted);
            } catch (Exception e) {
                log.warn("Hypothesis round failed for user {}", user.getId(), e);
            }
        }
    }
}
