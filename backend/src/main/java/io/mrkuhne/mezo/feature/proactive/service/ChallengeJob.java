package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Workout-challenge crons. Pre-generation (bd mezo-n8nas): just after midnight, proposes today's
 * planned-day challenges for every recently-seen user, so opening the workout never waits on the LLM
 * (the lazy GET stays the fallback). Outcome backstop (proactive P2, bd mezo-hbwi): resolves every
 * accepted challenge whose day has passed — the lazy GET evaluation covers the common path, this
 * catches challenges the user never re-opens. Per-user failures are isolated; both paths are
 * idempotent.
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
    private final ProactiveChallengeService challengeService;
    private final ProactiveProperties properties;

    @Scheduled(cron = "${mezo.proactive.challenge.generate-cron}")
    public void runPregenerate() {
        Instant cutoff = Instant.now().minus(properties.challenge().presenceDays(), ChronoUnit.DAYS);
        AtomicInteger proposed = new AtomicInteger();
        userFanOut.forEachActiveUser("Challenge pre-generate", user -> {
            // Presence is last_seen_at (stamped only by an authenticated request), never the
            // challenge rows this job writes itself — the QuestJob rule: no LLM spend for someone
            // who stopped opening the app.
            if (user.getLastSeenAt() == null || user.getLastSeenAt().isBefore(cutoff)) {
                return;
            }
            try {
                proposed.addAndGet(challengeService.pregenerateToday(user.getId()));
            } catch (Exception e) {
                log.warn("Challenge pre-generation failed for user {}", user.getId(), e);
            }
        });
        log.info("Challenge pre-generate run: {} challenge(s) ready for today", proposed.get());
    }

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
