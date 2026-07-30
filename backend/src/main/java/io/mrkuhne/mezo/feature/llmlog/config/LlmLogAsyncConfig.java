package io.mrkuhne.mezo.feature.llmlog.config;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * The audit writer's own bounded pool (mezo-2zyu). Audit logging gets a SEPARATE, deliberately tiny
 * executor rather than the shared {@code applicationTaskExecutor} so a burst of logged calls can
 * never starve the companion's post-turn work.
 *
 * <p>Saturation policy is {@link ThreadPoolExecutor.DiscardPolicy}: once the bounded queue is full
 * the audit row is genuinely DROPPED. The default {@code AbortPolicy} would instead throw
 * {@code TaskRejectedException} back through the synchronous {@code publishEvent} into the user's
 * LLM call — the busiest moment would be exactly when logging starts breaking calls. Losing audit
 * rows under load is the correct trade; caller-runs (which would stall the request path) is
 * explicitly not used either.
 *
 * <p>{@code defaultCandidate = false} is load-bearing: Boot's {@code applicationTaskExecutor}
 * auto-configuration backs off as soon as ANY {@code Executor} bean exists, which would silently
 * re-route every plain {@code @Async} in the app onto this 1-thread pool. Marking the bean a
 * non-default candidate keeps it out of both that condition and by-type injection; it is reachable
 * only by name, which is exactly how {@code @Async("llmLogExecutor")} resolves it.
 *
 * <p>{@code @EnableAsync} is deliberately NOT repeated here — {@code techcore.configuration
 * .AsyncConfiguration} already enables it app-wide.
 */
@Configuration
@RequiredArgsConstructor
public class LlmLogAsyncConfig {

    private final LlmLogProperties llmLogProperties;

    /**
     * No explicit {@code initialize()}: {@link ThreadPoolTaskExecutor} is an {@code InitializingBean},
     * so Spring calls it — doing it here as well would build a second pool and orphan the first.
     */
    @Bean(name = "llmLogExecutor", defaultCandidate = false)
    public Executor llmLogExecutor() {
        LlmLogProperties.Executor pool = llmLogProperties.executor();
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(pool.coreSize());
        executor.setMaxPoolSize(pool.maxSize());
        executor.setQueueCapacity(pool.queueCapacity());
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy());
        executor.setThreadNamePrefix("llm-log-");
        return executor;
    }
}
