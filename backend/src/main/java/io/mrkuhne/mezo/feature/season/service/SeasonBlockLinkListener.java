package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.train.MesocycleStarted;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Éves terv (mezo-r36n9.113): the season follows a newly started block. Runs synchronously once the start committed
 * ({@link SeasonService#adoptStartedBlock} in its own transaction); a failure is logged and never fails the start —
 * the block keeps running, the season keeps its previous block.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SeasonBlockLinkListener {

    private final SeasonService seasonService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStarted(MesocycleStarted event) {
        try {
            seasonService.adoptStartedBlock(event.userId(), event.mesocycleId(), event.startDate());
        } catch (RuntimeException e) {
            log.warn("Season could not follow the started block {} of {}", event.mesocycleId(), event.userId(), e);
        }
    }
}
