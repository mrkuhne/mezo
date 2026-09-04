package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Optional offline generation backfill; it never changes the online serving generation. */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {
            FeaturesConfiguration.COMPANION_SWITCH,
            FeaturesConfiguration.MEMORY_REEMBEDDING_JOB_SWITCH
        },
        havingValue = "true")
public class MemoryReembeddingJob {

    private final UserFanOut userFanOut;
    private final MemoryReembeddingService reembeddingService;
    private final MemoryPlatformProperties properties;

    @Scheduled(cron = "${mezo.companion.memory-platform.reembedding.cron}")
    public void run() {
        var config = properties.reembedding();
        userFanOut.forEachActiveUser("Memory re-embedding", user -> {
            var result = reembeddingService.reembedMissing(
                    user.getId(), config.targetVersion(), config.batchSize());
            log.info("Memory re-embedding for user {}: {} selected, {} ready, {} failed",
                    user.getId(), result.selected(), result.ready(), result.failed());
        });
    }
}
