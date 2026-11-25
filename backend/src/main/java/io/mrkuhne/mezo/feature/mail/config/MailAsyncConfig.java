package io.mrkuhne.mezo.feature.mail.config;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.concurrent.Executor;
import java.util.concurrent.RejectedExecutionException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * The morning post's own single-thread pool (mezo-r36n9.39): the twice-daily run and the manual runs execute one at
 * a time, so two runs never read the same mailbox at once. A full queue drops the run with a warning and a
 * {@link RejectedExecutionException} to the caller (the job logs it, a manual run answers 429 without being
 * accepted). {@code defaultCandidate = false}: it must never become the app's default {@code @Async} executor.
 */
@Slf4j
@Configuration
@ConditionalOnProperty(name = FeaturesConfiguration.MAIL_SWITCH, havingValue = "true")
public class MailAsyncConfig {

    public static final String EXECUTOR = "mailExecutor";

    private static final int QUEUE = 8;

    @Bean(name = EXECUTOR, defaultCandidate = false)
    public Executor mailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(QUEUE);
        executor.setRejectedExecutionHandler((task, pool) -> {
            log.warn("Mail run dropped: the queue is full ({} waiting)", pool.getQueue().size());
            throw new RejectedExecutionException("mail queue full");
        });
        executor.setThreadNamePrefix("mail-");
        return executor;
    }
}
