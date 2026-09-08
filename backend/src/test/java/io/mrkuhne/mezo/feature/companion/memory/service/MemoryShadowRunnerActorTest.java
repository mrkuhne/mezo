package io.mrkuhne.mezo.feature.companion.memory.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.core.task.support.TaskExecutorAdapter;

/**
 * mezo-ozri.7: the shadow run is the FIRST executor hop, so the actor it fails to carry can never
 * be recovered by the hops it triggers downstream.
 *
 * <p>The executor is a real single-thread pool, NOT a {@code SyncTaskExecutor}: a synchronous
 * executor runs the task on the caller's thread, where the ThreadLocal is still bound, and the
 * assertion would pass with no propagation code at all.
 */
class MemoryShadowRunnerActorTest {

    private final ExecutorService pool = Executors.newSingleThreadExecutor();

    @AfterEach
    void shutDownPool() {
        pool.shutdownNow();
    }

    @Test
    void testSubmit_shouldRunTheShadowRetrievalAsTheSubmittingActor_whenAnActorIsBound()
            throws InterruptedException {
        UUID user = UUID.randomUUID();
        AtomicReference<UUID> seenInsideTask = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        MemoryContextService memoryContextService = mock(MemoryContextService.class);
        when(memoryContextService.retrieve(any(), any())).thenAnswer(invocation -> {
            seenInsideTask.set(LlmActorContext.capture());
            done.countDown();
            return null;
        });
        MemoryShadowRunner runner = new MemoryShadowRunner(memoryContextService, poolExecutor());

        LlmActorContext.runAs(user, () -> runner.submit(request(user)));

        assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(seenInsideTask.get()).isEqualTo(user);
    }

    @Test
    void testSubmit_shouldStillRunTheShadowRetrieval_whenThereIsNoActorToCapture()
            throws InterruptedException {
        CountDownLatch done = new CountDownLatch(1);
        MemoryContextService memoryContextService = mock(MemoryContextService.class);
        when(memoryContextService.retrieve(any(), any())).thenAnswer(invocation -> {
            done.countDown();
            return null;
        });
        MemoryShadowRunner runner = new MemoryShadowRunner(memoryContextService, poolExecutor());

        runner.submit(request(UUID.randomUUID()));

        assertThat(done.await(5, TimeUnit.SECONDS)).isTrue();
    }

    private AsyncTaskExecutor poolExecutor() {
        return new TaskExecutorAdapter(pool);
    }

    private static MemoryRequest request(UUID user) {
        return new MemoryRequest(user, ConsumerPolicy.CHAT_AMBIENT, "Mi történt Boglárkával?",
                List.of(), LocalDate.of(2026, 9, 8), 1200, UUID.randomUUID(), false);
    }
}
