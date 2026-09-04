package io.mrkuhne.mezo.feature.companion.memory.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Runs the NEW projection only after the OLD memory transaction is durable. Projection failures
 * are therefore observable and retryable without rolling back the serving path.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MemoryProjectionListener {

    private final MemoryProjectionWriter projectionWriter;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onUpsert(MemoryProjectionEvent.Upsert event) {
        try {
            projectionWriter.upsert(event.command(), event.embedding());
        } catch (RuntimeException e) {
            log.warn("Canonical memory projection failed for {} {} — OLD remains available",
                    event.command().sourceKind(), event.command().sourceId(), e);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onSuppress(MemoryProjectionEvent.Suppress event) {
        try {
            projectionWriter.suppress(event.userId(), event.sourceKind(), event.sourceId());
        } catch (RuntimeException e) {
            log.warn("Canonical memory suppression failed for {} {} — OLD lifecycle remains authoritative",
                    event.sourceKind(), event.sourceId(), e);
        }
    }
}
