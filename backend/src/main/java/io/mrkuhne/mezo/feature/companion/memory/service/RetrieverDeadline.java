package io.mrkuhne.mezo.feature.companion.memory.service;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;

/**
 * mezo-lb2yb: one retriever's time budget, measured from when the task STARTS on the pool — not
 * from submission. Retrieval runs on the shared application executor, and production runs bunch up
 * in the dawn job burst; with a submission-time deadline a retriever that merely waited in the
 * queue was declared timed out before it ran (lexical TIMEOUT in 186 of 194 runs). Queueing gets
 * its own cap ({@code queueWaitNanos}) so a saturated pool still cannot hang a caller: the worst
 * case is queue cap + run budget.
 */
final class RetrieverDeadline {

    private static final long NOT_STARTED = Long.MIN_VALUE;

    private final long submittedNanos;
    private final long timeoutNanos;
    private final long queueWaitNanos;
    private final AtomicLong startedNanos = new AtomicLong(NOT_STARTED);

    RetrieverDeadline(long submittedNanos, long timeoutNanos, long queueWaitNanos) {
        this.submittedNanos = submittedNanos;
        this.timeoutNanos = timeoutNanos;
        this.queueWaitNanos = queueWaitNanos;
    }

    /** Called by the task itself, first thing on the pool thread. */
    void markStarted() {
        startedNanos.compareAndSet(NOT_STARTED, System.nanoTime());
    }

    /** Waits for {@code future} within the budget; {@link TimeoutException} when it ran out. */
    <T> T await(Future<T> future) throws InterruptedException, ExecutionException, TimeoutException {
        while (true) {
            if (future.isDone()) {
                return future.get();
            }
            long started = startedNanos.get();
            long deadline = started == NOT_STARTED ? submittedNanos + queueWaitNanos : started + timeoutNanos;
            long remaining = deadline - System.nanoTime();
            if (remaining <= 0) {
                if (future.isDone()) {
                    return future.get();
                }
                throw new TimeoutException(started == NOT_STARTED
                        ? "retriever never left the executor queue"
                        : "retriever deadline elapsed");
            }
            try {
                return future.get(remaining, TimeUnit.NANOSECONDS);
            } catch (TimeoutException waitedEnough) {
                // loop: if the task started while we waited on the queue cap, its own budget applies now
            }
        }
    }

    /** Whether a result completed at {@code completedNanos} is inside the run budget. */
    boolean finishedInTime(long completedNanos) {
        long started = startedNanos.get();
        return started != NOT_STARTED && completedNanos - started <= timeoutNanos;
    }

    /** Milliseconds since submission — for traces of tasks that failed without finishing. */
    long elapsedSinceSubmissionMillis() {
        return Math.max(0L, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - submittedNanos));
    }
}
