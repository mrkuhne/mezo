package io.mrkuhne.mezo.feature.companion.feedback.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * The W4.2 nightly rollup cron (bd mezo-b3pp.16, spec §8.2) — the {@code PatternDetectionJob}
 * idiom: per-user isolation, one bad user never kills the run. 03:10, after the pattern-detection
 * job (02:40) and the Sunday hypothesis loop (03:00), purely by dawn-window convention — this job
 * reads {@code message_feedback} directly, never the other jobs' output.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.FEEDBACK_LEARNING_JOB_SWITCH},
        havingValue = "true")
public class FeedbackLearningJob {

    private final UserFanOut userFanOut;
    private final FeedbackLearningService feedbackLearningService;

    @Scheduled(cron = "${mezo.companion.feedback-learning.cron}")
    public void run() {
        userFanOut.forEachActiveUser("Feedback learning", user -> {
            try {
                int upserted = feedbackLearningService.computeRollups(user.getId());
                log.info("Feedback-learning rollup for user {}: {} scope(s) upserted", user.getId(), upserted);
            } catch (Exception e) {
                log.warn("Feedback-learning rollup failed for user {}", user.getId(), e);
            }
        });
    }
}
