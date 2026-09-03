package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Workout-challenge outcome backstop (proactive P2, bd mezo-hbwi): a single daily cron that resolves
 * every accepted challenge whose day has passed — the lazy GET evaluation covers the common path, this
 * catches challenges the user never re-opens. Per-user failures are isolated; the evaluator is
 * idempotent (only accepted rows transition).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.CHALLENGE_JOB_SWITCH},
        havingValue = "true")
public class ChallengeJob {

    private final UserFanOut userFanOut;
    private final ChallengeOutcomeEvaluator outcomeEvaluator;

    @Scheduled(cron = "${mezo.proactive.challenge.outcome-cron}")
    public void runOutcome() {
        LocalDate today = LocalDate.now();
        AtomicInteger resolved = new AtomicInteger();
        userFanOut.forEachActiveUser("Challenge outcome", user -> {
            try {
                resolved.addAndGet(outcomeEvaluator.evaluateDue(user.getId(), today));
            } catch (Exception e) {
                log.warn("Challenge outcome eval failed for user {} on {}", user.getId(), today, e);
            }
        });
        log.info("Challenge outcome run for {}: {} challenge(s) resolved", today, resolved.get());
    }
}
