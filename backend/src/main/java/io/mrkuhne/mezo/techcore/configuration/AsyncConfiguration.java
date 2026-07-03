package io.mrkuhne.mezo.techcore.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Enables {@code @Async} (born with the V1.2 post-turn fact extraction listener). Boot's
 * auto-configured {@code applicationTaskExecutor} serves the async calls — pool tuning, if ever
 * needed, belongs in {@code spring.task.execution.*} YAML, not here (configuration_conventions).
 */
@Configuration
@EnableAsync
public class AsyncConfiguration {
}
