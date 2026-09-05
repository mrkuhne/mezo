package io.mrkuhne.mezo.feature.companion.memory;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetrievalRetentionJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    // mezo-oou9: the shared test profile now disables this cron by default (kill-switch
    // completeness) — this IT drives the job directly, so it re-enables it on its own context.
    "mezo.techcore.cron.memory-retrieval-retention-job.enabled=true"
})
class MemoryRetrievalRetentionIT extends AbstractIntegrationTest {

    @Autowired private MemoryRetrievalRetentionJob job;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private MemoryRetrievalResultRepository resultRepository;
    @Autowired private MemoryRetrievalFeedbackRepository feedbackRepository;
    @Autowired private JdbcTemplate jdbc;

    @Test
    void testRun_shouldHardDeleteExpiredRunsAndCascadeChildren_whenOwnerIsActive() {
        UUID owner = userPopulator.createUser().getId();
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Régi audit emlék", LocalDate.now().minusDays(40));
        MemoryRetrievalRunEntity expired = memoryPopulator.run(owner, UUID.randomUUID());
        MemoryRetrievalResultEntity result = memoryPopulator.result(
                owner, expired, item, 1, true, ScoreBreakdownEnvelope.empty());
        MemoryRetrievalFeedbackEntity feedback = memoryPopulator.feedback(owner, expired, result, item, "useful");
        MemoryRetrievalRunEntity recent = memoryPopulator.run(owner, UUID.randomUUID());
        jdbc.update("update memory_retrieval_run set created_at = ? where id = ?",
                Timestamp.from(Instant.now().minus(31, ChronoUnit.DAYS)), expired.getId());

        job.run();

        assertThat(runRepository.findById(expired.getId())).isEmpty();
        assertThat(resultRepository.findById(result.getId())).isEmpty();
        assertThat(feedbackRepository.findById(feedback.getId())).isEmpty();
        assertThat(runRepository.findById(recent.getId())).isPresent();
    }
}
