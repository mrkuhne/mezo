package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * The mezo-1y3p nightly retention scrub: NULLs the four payload columns of audit rows older than
 * {@code mezo.llm-log.retention.payload-days}, stamping {@code payload_scrubbed_at}. Hard and
 * irreversible by design — ADR 0014's standing exception to soft delete; no row is ever deleted,
 * so cost history (and the {@code created_by on delete set null} property) is untouched.
 *
 * <p>Deliberately NOT conditioned on {@code mezo.feature.llm-log.enabled}: the write switch and
 * the retention switch are independent — payload already on disk keeps aging while recording
 * is off.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.LLM_LOG_RETENTION_JOB_SWITCH, havingValue = "true")
public class LlmLogRetentionJob {

    private final LlmLogRepository llmLogRepository;
    private final LlmLogProperties properties;

    @Transactional
    @Scheduled(cron = "${mezo.llm-log.retention.cron}")
    public void run() {
        Instant now = Instant.now();
        Instant cutoff = now.minus(Duration.ofDays(properties.retention().payloadDays()));
        int scrubbed = llmLogRepository.scrubPayloadsOlderThan(cutoff, now);
        if (scrubbed > 0) {
            log.info("LLM-log retention: scrubbed payload of {} row(s) older than {}", scrubbed, cutoff);
        }
    }
}
