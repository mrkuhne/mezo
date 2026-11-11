package io.mrkuhne.mezo.feature.companion.memory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * mezo-lb2yb: the retriever deadline used to start at SUBMISSION, so in the dawn job burst a
 * retriever that waited in the shared executor's queue was declared timed out before it ran
 * (lexical TIMEOUT in 186 of 194 production runs). The budget now starts when the task starts;
 * queueing has its own, separate cap.
 */
class RetrieverDeadlineTest {

    private static final long TIMEOUT = TimeUnit.MILLISECONDS.toNanos(100);
    private static final long QUEUE_WAIT = TimeUnit.MILLISECONDS.toNanos(1_000);
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);

    @AfterEach
    void stop() {
        scheduler.shutdownNow();
    }

    @Test
    void aTaskThatQueuedLongerThanItsBudget_stillGetsItsFullBudgetOnceItStarts() throws Exception {
        RetrieverDeadline deadline = new RetrieverDeadline(System.nanoTime(), TIMEOUT, QUEUE_WAIT);
        CompletableFuture<String> future = new CompletableFuture<>();
        scheduler.schedule(deadline::markStarted, 300, TimeUnit.MILLISECONDS);         // queued 300 ms
        scheduler.schedule(() -> future.complete("ok"), 350, TimeUnit.MILLISECONDS);   // ran 50 ms

        assertThat(deadline.await(future)).isEqualTo("ok");
        assertThat(deadline.finishedInTime(System.nanoTime() - TimeUnit.MILLISECONDS.toNanos(1))).isTrue();
    }

    @Test
    void aStartedTaskThatRunsPastItsBudget_timesOut() {
        RetrieverDeadline deadline = new RetrieverDeadline(System.nanoTime(), TIMEOUT, QUEUE_WAIT);
        deadline.markStarted();
        CompletableFuture<String> never = new CompletableFuture<>();

        long before = System.nanoTime();
        assertThatThrownBy(() -> deadline.await(never)).isInstanceOf(TimeoutException.class);
        assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - before)).isLessThan(600);
    }

    @Test
    void aTaskThatNeverLeavesTheQueue_timesOutAtTheQueueCap() {
        RetrieverDeadline deadline = new RetrieverDeadline(System.nanoTime(),
                TIMEOUT, TimeUnit.MILLISECONDS.toNanos(200));
        CompletableFuture<String> never = new CompletableFuture<>();

        assertThatThrownBy(() -> deadline.await(never)).isInstanceOf(TimeoutException.class)
                .hasMessageContaining("queue");
    }

    @Test
    void completionAfterTheBudget_isNotInTime() {
        RetrieverDeadline deadline = new RetrieverDeadline(System.nanoTime(), TIMEOUT, QUEUE_WAIT);
        deadline.markStarted();
        assertThat(deadline.finishedInTime(System.nanoTime() + TIMEOUT * 2)).isFalse();
    }

    /** Review finding: the common case is await() BEFORE the pool thread marks the start. A task
     *  that starts at once and then hangs must time out at ~its run budget, not at the queue cap. */
    @Test
    void aTaskThatStartsJustAfterTheWaitBegins_timesOutAtItsRunBudget_notAtTheQueueCap() {
        RetrieverDeadline deadline = new RetrieverDeadline(System.nanoTime(), TIMEOUT, QUEUE_WAIT);
        CompletableFuture<String> never = new CompletableFuture<>();
        scheduler.schedule(deadline::markStarted, 5, TimeUnit.MILLISECONDS);

        long before = System.nanoTime();
        assertThatThrownBy(() -> deadline.await(never)).isInstanceOf(TimeoutException.class);
        assertThat(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - before)).isLessThan(500);
    }
}
