package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Learned workout-timing profile (mezo-dzbm, spec 2026-09-02 slice 2) — the
 * {@code FactExtractionListener}/{@code TurnEmbeddingListener} idiom applied to
 * {@link WorkoutFinishedEvent}: AFTER_COMMIT + {@code @Async}, so profile learning runs only once
 * {@code finishWorkout}'s completion write has actually landed, on a separate thread, well after
 * that transaction is gone — nothing this listener does can reach back and roll it back.
 *
 * <p>{@code @Async} is LOAD-BEARING, not decorative: without it, the AFTER_COMMIT callback runs
 * synchronously on the thread that just committed, with that transaction's resources (connection,
 * persistence context) still bound. {@code TimingProfileService.learnFrom}'s plain
 * {@code @Transactional} (REQUIRED) would then JOIN the already-committed transaction instead of
 * opening a fresh one, and every write inside it would be silently dropped with no exception —
 * committed nowhere, because there is no longer an active transaction to commit. {@code @Async}
 * detaches this onto a thread with no ambient transaction, so REQUIRED opens a genuinely new one.
 *
 * <p>Gated directly on the switch (matches every other listener in this codebase, e.g.
 * {@code TurnEmbeddingListener}): off ⇒ this bean does not exist ⇒ {@link WorkoutFinishedEvent}
 * has no listener ⇒ nothing is ever learned, with zero cost to the publish call itself.
 *
 * <p>Failures are logged and swallowed (same as every sibling listener): profile learning must
 * never surface as a user-visible error — the workout is already finished and committed by the
 * time this runs, so there is nothing left to protect except the log line.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.TIMING_PROFILE_SWITCH, havingValue = "true")
public class TimingProfileListener {

    private final TimingProfileService timingProfileService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onWorkoutFinished(WorkoutFinishedEvent event) {
        try {
            timingProfileService.learnFrom(event.createdBy(), event.workoutSessionId());
        } catch (RuntimeException e) {
            log.warn("Timing-profile learning failed for session {} — the workout finished anyway",
                event.workoutSessionId(), e);
        }
    }
}
