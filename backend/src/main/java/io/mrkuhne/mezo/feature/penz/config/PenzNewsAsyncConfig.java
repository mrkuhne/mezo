package io.mrkuhne.mezo.feature.penz.config;

import java.util.concurrent.Executor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * The news digest's own single-thread pool (mezo-r36n9.104): the twice-daily poll and the manual refreshes run on
 * it one at a time, so two runs never fetch the same feeds or rebuild the same digest concurrently. A full queue
 * drops the run with a warning — the next poll or refresh covers it. {@code defaultCandidate = false} for the same
 * reason as {@code LlmLogAsyncConfig}: it must never become the app's default {@code @Async} executor.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class PenzNewsAsyncConfig {

    public static final String EXECUTOR = "penzNewsExecutor";

    private final PenzNewsProperties properties;

    @Bean(name = EXECUTOR, defaultCandidate = false)
    public Executor penzNewsExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(properties.executorQueue());
        executor.setRejectedExecutionHandler((task, pool) ->
            log.warn("Penz news run dropped: the queue is full ({} waiting)", pool.getQueue().size()));
        executor.setThreadNamePrefix("penz-news-");
        return executor;
    }
}
