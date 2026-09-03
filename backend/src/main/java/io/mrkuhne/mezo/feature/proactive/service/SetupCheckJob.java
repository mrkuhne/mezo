package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Daily setup-check pass (S3, bd mezo-d58h.3). Setup checks are about CONFIGURATION, which no
 * write event announces — there is no on-write trigger to hang them on, so a cron is the whole
 * delivery mechanism (unlike flags, which have a listener AND a sweep).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.SETUP_CHECK_JOB_SWITCH},
        havingValue = "true")
public class SetupCheckJob {

    private final UserFanOut userFanOut;
    private final SetupCheckService setupCheckService;

    @Scheduled(cron = "${mezo.proactive.setup-checks.cron}")
    public void run() {
        userFanOut.forEachActiveUser("Setup check", user -> {
            try {
                // SetupCheckService already logs which check spoke (or why it stayed quiet).
                setupCheckService.runFor(user.getId());
            } catch (Exception e) {
                log.warn("Setup check failed for user {}", user.getId(), e);
            }
        });
    }
}
