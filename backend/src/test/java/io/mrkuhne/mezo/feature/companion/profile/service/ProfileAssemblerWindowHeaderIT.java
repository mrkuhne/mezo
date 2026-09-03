package io.mrkuhne.mezo.feature.companion.profile.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-b3pp.35 (item 3): the VISSZAJELZÉSEK header names the CONFIGURED window, not a hardcoded
 * 30. Own IT class — the {@code @TestPropertySource} override forks a separate Spring context
 * (the {@code NoteVectorLifecycleBudgetIT} precedent), and the rest of {@link ProfileAssemblerIT}
 * must keep the shipped-default (30-day) context.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.feedback-learning.window-days=14")
class ProfileAssemblerWindowHeaderIT extends AbstractIntegrationTest {

    @Autowired private ProfileAssembler assembler;
    @Autowired private FeedbackRollupRepository rollupRepository;
    @Autowired private DecisionEntryRepository decisionRepository;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FeedbackLearningService feedbackLearningService;

    @Test
    void renderPayload_statesTheConfiguredWindowInTheHeader_whenItIsNotThirty() {
        UUID owner = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        feedbackLearningService.computeRollups(owner);

        List<FeedbackRollupEntity> rollups =
                rollupRepository.findByCreatedByAndWindowDaysAndDeletedFalseOrderByScopeAsc(owner, 14);
        String payload = assembler.renderPayload(owner, LocalDate.now(), rollups,
                decisionRepository.findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(
                        owner, Limit.of(10)),
                List.of());

        assertThat(payload).contains("VISSZAJELZÉSEK (utolsó 14 nap):");
        assertThat(payload).doesNotContain("utolsó 30 nap");
    }
}
