package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
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
 * The S9.7 nightly provenance scrub (mezo-rj214.7): NULLs {@code ai_message.tool_outcomes} — the
 * RESULT half of a turn's provenance — on rows older than
 * {@code mezo.companion.turn.provenance.retention-days}. Hard and irreversible by design, same
 * standing exception as the llm-log payload scrub: no row is ever deleted, and
 * {@code tool_outcomes} is the ONLY column touched — {@code tool_calls} (the ASK, including the
 * planner's {@code why}) is kept forever, so a card past the window still shows what was asked,
 * just not what came back.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {
            FeaturesConfiguration.COMPANION_SWITCH,
            FeaturesConfiguration.COMPANION_PROVENANCE_RETENTION_JOB_SWITCH
        },
        havingValue = "true")
public class ProvenanceRetentionJob {

    private final AiMessageRepository aiMessageRepository;
    private final CompanionProperties properties;

    @Transactional
    @Scheduled(cron = "${mezo.companion.turn.provenance.cron}")
    public void run() {
        Instant cutoff = Instant.now().minus(Duration.ofDays(properties.turn().provenance().retentionDays()));
        int scrubbed = aiMessageRepository.scrubToolOutcomesOlderThan(cutoff);
        log.info("Companion provenance retention run: {} row(s) scrubbed (cutoff {})", scrubbed, cutoff);
    }
}
