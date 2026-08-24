package io.mrkuhne.mezo.feature.llmlog.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** mezo-1y3p: the nightly job end-to-end — 90-day window from live config, scrub through the bean. */
class LlmLogRetentionJobIT extends AbstractIntegrationTest {

    @Autowired private LlmLogRetentionJob llmLogRetentionJob;
    @Autowired private LlmLogRepository llmLogRepository;
    @Autowired private LlmLogPopulator llmLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldScrubOldAndSpareFresh_whenWindowIs90Days() {
        LlmLogEntity old = llmLogPopulator.logPayloadAt(
            Instant.now().minus(91, ChronoUnit.DAYS), ownerId(), "companion_chat", "s", "u", "r");
        LlmLogEntity fresh = llmLogPopulator.logPayloadAt(
            Instant.now().minus(89, ChronoUnit.DAYS), ownerId(), "companion_chat", "s", "u", "r");

        llmLogRetentionJob.run();

        assertThat(llmLogRepository.findById(old.getId()).orElseThrow().getPayloadScrubbedAt())
            .isNotNull();
        assertThat(llmLogRepository.findById(fresh.getId()).orElseThrow().getPayloadScrubbedAt())
            .isNull();
    }

    private UUID ownerId() {
        return userPopulator.createUser("job-test@test.hu").getId();
    }
}
