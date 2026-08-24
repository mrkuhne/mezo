package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;

/** W4.3 (mezo-b3pp.17): the two read-side finders the ProfileAssembler gathers with. */
class ProfileSourceFindersIT extends AbstractIntegrationTest {

    @Autowired
    private FeedbackRollupRepository rollupRepository;
    @Autowired
    private DecisionEntryRepository decisionRepository;
    @Autowired
    private FeedbackLearningService feedbackLearningService;
    @Autowired
    private JournalPopulator journalPopulator;
    @Autowired
    private UserPopulator userPopulator;

    @Test
    void reviewed_decisions_come_back_newest_first_and_unreviewed_stay_out() {
        UUID owner = userPopulator.createUser("profile-finders-decisions@test.local").getId();
        journalPopulator.createDecision(
                owner, LocalDate.of(2026, 7, 1), "Nem edzek hajnalban", LocalDate.of(2026, 7, 15), null);
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált, tartható volt.",
                Instant.parse("2026-07-20T08:00:00Z"));
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 5, 1), "Esti képernyőstop", 2, "Nem tartottam be.",
                Instant.parse("2026-06-15T08:00:00Z"));

        List<DecisionEntryEntity> reviewed = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(owner, Limit.of(10));

        assertThat(reviewed).extracting(DecisionEntryEntity::getDecisionText)
                .containsExactly("Heti 3 edzés", "Esti képernyőstop");
    }

    @Test
    void all_rollup_scopes_for_a_user_come_back_in_one_read() {
        UUID owner = userPopulator.createUser("profile-finders-rollups@test.local").getId();
        feedbackLearningService.computeRollups(owner);

        List<String> scopes = rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(owner)
                .stream().map(FeedbackRollupEntity::getScope)
                .toList();

        assertThat(scopes).hasSize(11).isSorted();
    }
}
