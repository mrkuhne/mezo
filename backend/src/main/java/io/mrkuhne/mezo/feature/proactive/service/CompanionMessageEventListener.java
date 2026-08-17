package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepLogSavedEvent;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightLogSavedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Event-driven companion-feed triggers (mezo-gst9): a fresh sleep/weight log fires its reaction
 * message right after the request that logged it, instead of waiting for the next cron. Listens
 * AFTER_COMMIT (so it only reacts to logs that actually persisted) and off the request thread
 * (@Async, via the existing {@code applicationTaskExecutor} — the PushDispatchExecutor
 * precedent), so a slow/failed LLM call never delays or fails the logging response.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class CompanionMessageEventListener {

    private final CompanionMessageGenerator generator;

    /** Fresh-night guard mirrors the generator's own gate; backfill logs never message. */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSleepLogged(SleepLogSavedEvent event) {
        LocalDate today = LocalDate.now();
        if (event.date().isBefore(today.minusDays(1))) {
            return;
        }
        try {
            generator.generateSleepReaction(event.userId(), today);
        } catch (Exception e) {
            log.warn("Sleep-reaction generation failed for {}", event.userId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onWeightLogged(WeightLogSavedEvent event) {
        LocalDate today = LocalDate.now();
        if (!event.date().equals(today)) {
            return;
        }
        try {
            generator.generateWeightReaction(event.userId(), today);
        } catch (Exception e) {
            log.warn("Weight-reaction generation failed for {}", event.userId(), e);
        }
    }
}
