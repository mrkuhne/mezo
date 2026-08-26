package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewJob;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W5.3 (mezo-b3pp.20): the cron reviews the JUST-FINISHED quarter for every user, then re-runs
 * the profile — per-user AND per-phase isolated (the GraphMaintenanceJob idiom).
 */
@ActiveProfiles("companion-fake")
class QuarterlyReviewJobIT extends AbstractIntegrationTest {

    @Autowired private QuarterlyReviewJob quarterlyReviewJob;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;

    /** The quarter the job will pick up: the one before the quarter we are standing in. */
    private static LocalDate lastFinishedQuarter() {
        return Quarters.previous(Quarters.startOf(LocalDate.now()));
    }

    @Test
    void testRun_shouldProposeSeasonsAndRebuildProfile_whenTheFinishedQuarterHasRungs() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate quarter = lastFinishedQuarter();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, quarter,
                "A negyedév első hónapja. [fake-season:[{\"title\":\"Nyugodt szezon\",\"summary\":\"Kiegyensúlyozott negyedév volt.\"}]]");
        // ProfileAssembler.rebuild's own "honest absence" gate needs SOME signal of its own
        // (feedback, a reviewed decision, or an ACTIVE PATTERN/PREFERENCE node) — a freshly
        // proposed SEASON *candidate* does not count (habitNodes filters on STATUS_ACTIVE and
        // KIND_PATTERN/PREFERENCE). A reviewed decision is the smallest fixture that opens that
        // gate (the ProfileAssemblerJobIT precedent), so phase 2 has something to write.
        journalPopulator.createReviewedDecision(owner, quarter, "Heti 3 edzés", 4, "Bevált.");

        quarterlyReviewJob.run();

        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .anySatisfy(n -> assertThat(n.getKind()).isEqualTo(GraphNodeEntity.KIND_SEASON));
        // Phase 2: the profile singleton exists because the pass re-ran the assembler on the
        // reviewed-decision signal seeded above.
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, ProfileAssembler.SOURCE_PROFILE, owner)).isPresent();
    }

    @Test
    void testRun_shouldNotThrow_whenAUserHasNothingToReview() {
        userPopulator.createUser();

        assertThatCode(() -> quarterlyReviewJob.run()).doesNotThrowAnyException();
    }
}
