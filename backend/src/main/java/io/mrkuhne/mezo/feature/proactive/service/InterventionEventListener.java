package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagRaisedEvent;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataIntegrityViolationException;
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
        } catch (DataIntegrityViolationException e) {
            // NOT expected any more (bd mezo-d58h.4): two same-day raises used to be able to both
            // pass the check-then-insert race in AdviceCardService#deliver before either committed,
            // with the partial unique index (one card per day) as the real arbiter and the loser's
            // insert failing here. Delivery is now serialized per user by the transaction-scoped
            // advisory lock AdviceCardService#deliver takes via CompanionMessageRepository
            // .lockForDelivery — the index is a backstop, not the arbiter. A violation on this path
            // today means that serialization stopped working (lock removed, refactored behind a
            // REQUIRES_NEW boundary, or a non-Postgres datasource where pg_advisory_xact_lock is a
            // no-op) — warn loudly, with the stack trace, so a regression here is loud rather than
            // silently swallowed the way the pre-fix "expected race" case used to be.
            log.warn("Intervention delivery for user {} flag {} hit the companion_message unique "
                    + "index — this should not happen any more now that AdviceCardService.deliver "
                    + "is serialized per user; investigate as a possible lock regression",
                event.userId(), event.flagKey(), e);
        } catch (Exception e) {
            log.warn("Intervention delivery failed for user {} flag {}", event.userId(), event.flagKey(), e);
        }
    }
}
