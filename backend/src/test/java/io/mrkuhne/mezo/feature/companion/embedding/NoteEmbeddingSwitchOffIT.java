package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.service.DailySummaryJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * embed-notes off ⇒ the nightly sweep's note pass does nothing — the toggle is HEALED by the pass,
 * never bypassed (the TurnEmbeddingSwitchOffIT idiom).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.companion.embedding.embed-notes=false",
    // mezo-c9k4: the shared test profile now disables this cron by default (kill-switch
    // completeness) — this IT drives the job directly, so it re-enables it on its own context.
    "mezo.techcore.cron.daily-summary-job.enabled=true"
})
class NoteEmbeddingSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private DailySummaryJob dailySummaryJob;
    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testJobRun_shouldEmbedNoNote_whenEmbedNotesOff() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        String longNote = "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam "
                + "mint általában, és ez a séta után jött meg igazán.";
        var checkIn = checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, longNote);

        dailySummaryJob.run();

        assertThat(noteEmbeddingCatchUp.run(owner, yesterday)).isZero();
        assertThat(memoryEmbeddingRepository.existsByKindAndRefId(
                MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, checkIn.getId())).isFalse();
    }
}
