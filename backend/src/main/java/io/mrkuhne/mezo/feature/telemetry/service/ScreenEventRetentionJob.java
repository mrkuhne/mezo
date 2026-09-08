package io.mrkuhne.mezo.feature.telemetry.service;

import io.mrkuhne.mezo.feature.telemetry.config.TelemetryProperties;
import io.mrkuhne.mezo.feature.telemetry.repository.ScreenEventRepository;
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
 * Hard-deletes screen events older than {@code mezo.telemetry.retention-days} (bd mezo-o5cz,
 * spec §3). Unlike the llm-log scrub this is a real DELETE, not a column NULLing: a screen view
 * is disposable by design, there is no cost attribution or audit value to preserve.
 *
 * <p>Gated by the SAME switch as ingest — with screen telemetry off nothing writes rows, so a
 * retention job would have nothing to age (the llm-log precedent of an independent retention
 * switch exists because payload already on disk keeps aging while recording is off; here the
 * table simply stops growing).
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SCREEN_TELEMETRY_SWITCH, havingValue = "true")
public class ScreenEventRetentionJob {

    private final ScreenEventRepository repository;
    private final TelemetryProperties properties;

    @Transactional
    @Scheduled(cron = "${mezo.telemetry.retention-cron}")
    public void run() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(properties.retentionDays()));
        int deleted = repository.deleteOlderThan(cutoff);
        log.info("Screen-event retention run: {} row(s) deleted (cutoff {})", deleted, cutoff);
    }
}
