package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.feature.proactive.service.BriefingJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * B1.2 dawn cron: generates TODAY's briefing per user (no multi-day backfill — the lazy GET
 * is the miss-recovery), is idempotent, and isolates per-user failures. run() is invoked
 * directly (the DailySummaryJobIT idiom); NOT @Transactional so the job's own transactions
 * commit and ResetDatabase cleans up.
 */
@ActiveProfiles("companion-fake")
class BriefingJobIT extends AbstractIntegrationTest {

    @Autowired private BriefingJob briefingJob;
    @Autowired private BriefingRepository briefingRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldGenerateTodaysBriefing_whenUserHasNarrativeMemory() {
        UUID user = userPopulator.createUser("job-gen@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap edzés volt.");

        briefingJob.run();

        assertThat(briefingRepository.findByCreatedByAndBriefingDate(user, LocalDate.now()))
                .hasValueSatisfying(b -> {
                    assertThat(b.getContent().eyebrow()).isEqualTo("Fake briefing");
                    assertThat(b.getRegenCount()).isZero();
                });
    }

    @Test
    void testRun_shouldBeIdempotent_whenBriefingAlreadyExists() {
        UUID user = userPopulator.createUser("job-idem@test.local").getId();
        dailySummaryPopulator.summary(user, LocalDate.now().minusDays(1), "Tegnap úszás volt.");

        briefingJob.run();
        BriefingEntity first = briefingRepository
                .findByCreatedByAndBriefingDate(user, LocalDate.now()).orElseThrow();
        briefingJob.run();

        assertThat(briefingRepository.findByCreatedByAndBriefingDate(user, LocalDate.now()))
                .hasValueSatisfying(b -> assertThat(b.getId()).isEqualTo(first.getId()));
    }

    @Test
    void testRun_shouldSkipUserWithoutMemory_andStillServeOthers() {
        UUID bare = userPopulator.createUser("job-bare@test.local").getId();
        UUID rich = userPopulator.createUser("job-rich@test.local").getId();
        dailySummaryPopulator.summary(rich, LocalDate.now().minusDays(1), "Tegnap futás volt.");

        briefingJob.run();

        assertThat(briefingRepository.findByCreatedByAndBriefingDate(bare, LocalDate.now())).isEmpty();
        assertThat(briefingRepository.findByCreatedByAndBriefingDate(rich, LocalDate.now())).isPresent();
    }
}
