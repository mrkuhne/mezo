package io.mrkuhne.mezo.feature.llmlog.config;

import java.util.concurrent.Executor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * The audit writer's own bounded pool (mezo-2zyu). Audit logging gets a SEPARATE, deliberately tiny
 * executor rather than the shared {@code applicationTaskExecutor} so a burst of logged calls can
 * never starve the companion's post-turn work — and so a saturated log queue degrades by dropping
 * audit rows (caller-runs is explicitly NOT used), not by stalling anything user-facing.
 *
 * <p>{@code defaultCandidate = false} is load-bearing: Boot's {@code applicationTaskExecutor}
 * auto-configuration backs off as soon as ANY {@code Executor} bean exists, which would silently
 * re-route every plain {@code @Async} in the app onto this 1-thread pool. Marking the bean a
 * non-default candidate keeps it out of both that condition and by-type injection; it is reachable
 * only by name, which is exactly how {@code @Async("llmLogExecutor")} resolves it.
 */
@Configuration
@EnableAsync
@RequiredArgsConstructor
public class LlmLogAsyncConfig {

    private final LlmLogProperties llmLogProperties;

    @Bean(name = "llmLogExecutor", defaultCandidate = false)
    public Executor llmLogExecutor() {
        LlmLogProperties.Executor pool = llmLogProperties.executor();
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(pool.coreSize());
        executor.setMaxPoolSize(pool.maxSize());
        executor.setQueueCapacity(pool.queueCapacity());
        executor.setThreadNamePrefix("llm-log-");
        executor.initialize();
        return executor;
    }
}
