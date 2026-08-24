package io.mrkuhne.mezo.feature.companion.embedding;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * W1.5 blast-radius guard, isolated from {@link NoteEmbeddingCatchUpIT} because it needs its own
 * {@code note-batch-size} override: the budget caps the WHOLE run across every
 * {@code NarrativeNoteSource}, not one budget per source.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.embedding.note-batch-size=1")
class NoteEmbeddingBudgetIT extends AbstractIntegrationTest {

    private static final String LONG_NOTE =
            "Ma este végre leültem és átgondoltam a hetet, sokkal nyugodtabb voltam mint általában, "
            + "és ez a séta után jött meg igazán.";

    @Autowired private NoteEmbeddingCatchUp noteEmbeddingCatchUp;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private CheckInPopulator checkInPopulator;

    @Test
    void testRun_shouldStopAtTheBudget_whenBothSourcesHaveCandidates() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);

        int written = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(written).isEqualTo(1);
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(1);
    }

    @Test
    void testRun_shouldConvergeOnTheRemainder_whenRunAgainTheNextNight() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate yesterday = LocalDate.now().minusDays(1);
        activityPopulator.activity(owner, yesterday, LONG_NOTE, "mindset", 10, "AI");
        checkInPopulator.createCheckIn(owner, yesterday, "18:00", 3, 4, LONG_NOTE);

        int firstNight = noteEmbeddingCatchUp.run(owner, yesterday);
        int secondNight = noteEmbeddingCatchUp.run(owner, yesterday);

        assertThat(firstNight).isEqualTo(1);
        assertThat(secondNight).isEqualTo(1);
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(2);
    }
}
