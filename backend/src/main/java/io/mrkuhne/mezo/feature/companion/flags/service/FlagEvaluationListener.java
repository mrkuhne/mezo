package io.mrkuhne.mezo.feature.companion.flags.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInSavedEvent;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * W5.1 on-write evaluation (bd mezo-b3pp.18, spec §9.1) — the {@code CompanionMessageEventListener}
 * template: AFTER_COMMIT (so only persisted writes are reacted to) and off the request thread
 * ({@code @Async}, existing {@code applicationTaskExecutor}), so the evaluator can never delay or
 * fail the check-in/sleep response. The hourly {@code FlagSweepJob} covers the windows that are
 * crossed by time alone; both call the same {@link FlagService}, differing only in {@code source}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FlagEvaluationListener {

    private final FlagService flagService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onCheckInSaved(CheckInSavedEvent event) {
        evaluate(event.userId(), "check-in");
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSleepLogged(SleepLogSavedEvent event) {
        evaluate(event.userId(), "sleep-log");
    }

    private void evaluate(UUID userId, String trigger) {
        try {
            flagService.evaluateAndLog(userId, FlagKey.SOURCE_WRITE);
        } catch (Exception e) {
            log.warn("Flag evaluation after {} failed for user {}", trigger, userId, e);
        }
    }
}
