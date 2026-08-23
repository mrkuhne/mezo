package io.mrkuhne.mezo.feature.companion.profile;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssembler;
import io.mrkuhne.mezo.feature.companion.profile.service.ProfileAssemblerJob;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** W4.3 (mezo-b3pp.17): the weekly job sweeps every user and never lets one failure kill the run. */
@ActiveProfiles("companion-fake")
class ProfileAssemblerJobIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileAssemblerJob job;
    @Autowired
    private GraphNodeRepository nodeRepository;
    @Autowired
    private FeedbackPopulator feedbackPopulator;
    @Autowired
    private JournalPopulator journalPopulator;
    @Autowired
    private UserPopulator userPopulator;
    @Autowired
    private FeedbackLearningService feedbackLearningService;

    @Test
    void the_run_writes_a_profile_for_a_user_with_signal() {
        UUID owner = userPopulator.createUser("profile-assembler-job@test.local").getId();
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
        feedbackLearningService.computeRollups(owner);

        job.run();

        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, ProfileAssembler.SOURCE_PROFILE, owner)).isPresent();
    }
}
