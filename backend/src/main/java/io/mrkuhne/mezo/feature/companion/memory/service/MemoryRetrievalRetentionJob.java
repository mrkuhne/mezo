package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.auth.service.UserFanOut;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Physically removes expired retrieval traces; source-domain memories remain untouched. */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryRetrievalRetentionJob {

    private final UserFanOut userFanOut;
    private final MemoryRetrievalAuditWriter auditWriter;
    private final MemoryPlatformProperties properties;

    @Scheduled(cron = "${mezo.companion.memory-platform.audit.retention-cron}")
    public void run() {
        Instant cutoff = Instant.now().minus(properties.audit().retentionDays(), ChronoUnit.DAYS);
        userFanOut.forEachActiveUser("Memory retrieval retention", user -> {
            int deleted = auditWriter.hardDeleteExpired(user.getId(), cutoff);
            log.info("Memory retrieval retention for user {}: {} run(s) deleted", user.getId(), deleted);
        });
    }
}
