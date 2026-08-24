package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * W5.2 glue (bd mezo-b3pp.19): a persisted flag raise → intervention delivery, AFTER_COMMIT (only
 * raises that really logged) and {@code @Async} off the raising thread (the
 * CompanionMessageEventListener template — a slow DB moment must never delay a check-in save).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH,
                FeaturesConfiguration.INTERVENTION_SWITCH},
        havingValue = "true")
public class InterventionEventListener {

    private final InterventionService interventionService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onFlagRaised(FlagRaisedEvent event) {
        try {
            interventionService.deliverForFlag(event.userId(), event.flagKey());
        } catch (Exception e) {
            log.warn("Intervention delivery failed for user {} flag {}", event.userId(), event.flagKey(), e);
        }
    }
}
