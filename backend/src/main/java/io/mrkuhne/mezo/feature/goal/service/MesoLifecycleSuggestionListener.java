package io.mrkuhne.mezo.feature.goal.service;

import io.mrkuhne.mezo.feature.train.MesocycleActivated;
import io.mrkuhne.mezo.feature.train.MesocycleClosed;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Meso lifecycle → diet-phase suggestion probe (Diet Plan slice 4). AFTER_COMMIT + {@code @Async}
 * like {@code MesoReviewListener}/{@code MentionDetectionListener} (the repo's uniform
 * {@code @TransactionalEventListener} idiom): the probe reads committed state and writes its own
 * transaction on the executor thread, and a failure here must never escape onto the executor's
 * default handler — logged and swallowed. ITs exercise
 * {@code GoalSuggestionTriggerService.onMesoLifecycle} directly — a rolled-back test tx never
 * fires these (the {@code MesocycleClosed} contract).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MesoLifecycleSuggestionListener {

    private final GoalSuggestionTriggerService triggerService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMesocycleActivated(MesocycleActivated event) {
        try {
            triggerService.onMesoLifecycle(event.userId());
        } catch (Exception e) {
            log.warn("Phase-suggestion probe failed after meso activation {}", event.mesocycleId(), e);
        }
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMesocycleClosed(MesocycleClosed event) {
        try {
            triggerService.onMesoLifecycle(event.userId());
        } catch (Exception e) {
            log.warn("Phase-suggestion probe failed after meso close {}", event.mesocycleId(), e);
        }
    }
}
