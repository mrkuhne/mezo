package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.TimingProfileGate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Learned workout-timing profile (mezo-dzbm, spec 2026-09-02 slice 2) — the
 * {@code FactExtractionListener}/{@code TurnEmbeddingListener} idiom applied to
 * {@link WorkoutFinishedEvent}: AFTER_COMMIT + {@code @Async}, so profile learning runs only once
 * {@code finishWorkout}'s completion write has actually landed, on its own thread, well after
 * that transaction is gone. There is deliberately no {@code @Transactional} annotation ON THIS
 * METHOD — {@code TimingProfileService.learnFrom} already carries plain {@code @Transactional},
 * and because {@code @Async} runs it on a detached thread with no ambient transaction, that
 * REQUIRED annotation opens a genuinely NEW transaction here on its own, with the exact same
 * effect as REQUIRES_NEW (there is nothing to join). Tried adding an explicit {@code
 * @Transactional(propagation = REQUIRES_NEW)} here too, on top of that: it works (finishWorkout's
 * write still survives), but it wraps THIS method in a second, OUTER transaction whose own
 * proxy — seeing {@code learnFrom}'s inner @Transactional mark the (now-participating, from ITS
 * perspective) transaction rollback-only on the exact same DataIntegrityViolationException this
 * feature's fault-injection test throws — fails its OWN commit after the try/catch below already
 * returned normally, surfacing a second, spurious {@code UnexpectedRollbackException} via
 * Spring's {@code SimpleAsyncUncaughtExceptionHandler} (an ERROR-level log with no test or user
 * impact, confirmed by running it, but needless noise for a failure this method already caught
 * and logged at WARN). Matching the established shape exactly (no listener in this codebase
 * wraps itself in its own {@code @Transactional}) avoids that entirely: {@code learnFrom}'s own
 * transaction is then the sole, outermost one, so a failure inside it just rolls back cleanly
 * and returns the original exception straight to this catch block — nothing left to fail on
 * commit afterward.
 *
 * <p>Gated here, on the listener bean — via {@code @ConditionalOnBean(TimingProfileGate.class)},
 * the same shape {@code PantryImportService} uses for {@code OffClient} — not on {@code
 * WorkoutService}'s publish call: off ⇒ {@code TimingProfileGate} does not exist ⇒ THIS bean
 * does not exist ⇒ {@link WorkoutFinishedEvent} has no listener ⇒ nothing is ever learned, with
 * zero cost to the publish call itself.
 *
 * <p>Failures are logged and swallowed (same as every sibling listener): profile learning must
 * never surface as a user-visible error — the workout is already finished and committed by the
 * time this runs, so there is nothing left to protect except the log line.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnBean(TimingProfileGate.class)
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
