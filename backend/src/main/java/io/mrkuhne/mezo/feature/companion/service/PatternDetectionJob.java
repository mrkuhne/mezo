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
 * The V3.1 nightly correlation cron (the DailySummaryJob idiom — per-user isolation, one bad
 * user never kills the run). Runs after the summary job (02:40 vs 02:20) purely by convention —
 * the two are independent; detection reads L0 directly, never the summaries.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PATTERN_DETECTION_JOB_SWITCH},
        havingValue = "true")
public class PatternDetectionJob {

    private final AppUserRepository appUserRepository;
    private final PatternDetectionService patternDetectionService;

    @Scheduled(cron = "${mezo.companion.patterns.cron}")
    public void run() {
        for (AppUserEntity user : appUserRepository.findAll()) {
            try {
                int upserted = patternDetectionService.detect(user.getId());
                log.info("Pattern detection for user {}: {} pair(s) upserted", user.getId(), upserted);
            } catch (Exception e) {
                log.warn("Pattern detection failed for user {}", user.getId(), e);
            }
        }
    }
}
