package io.mrkuhne.mezo.feature.companion.quarterly.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W5.3 final review (mezo-b3pp.20, F3): the season prompt must not present a 30-day rollup as
 * quarter-wide evidence.
 *
 * <p>Package-scoped alongside {@link QuarterlyReviewService} (not {@code ...companion.quarterly},
 * where the sibling {@code QuarterlyReviewServiceIT} lives) deliberately — the
 * {@code ProfileAssemblerIT} precedent: the assertion needs to read the rendered prompt directly,
 * and {@link QuarterlyReviewService#buildUserMessage} is package-private exactly so a test can do
 * that without a public seam existing only for tests. Going through {@code runFor} instead would
 * only ever show the FAKE's answer, never the payload the real model would be handed — and the
 * defect here IS the payload's wording.
 */
@ActiveProfiles("companion-fake")
class QuarterlyReviewPayloadIT extends AbstractIntegrationTest {

    private static final LocalDate Q3 = LocalDate.of(2026, 7, 1);

    @Autowired private QuarterlyReviewService quarterlyReviewService;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private FeedbackLearningService feedbackLearningService;
    @Autowired private UserPopulator userPopulator;

    /**
     * The rollup rows must be written by the REAL {@code FeedbackLearningService}, not hand-built:
     * {@code windowDays} is what the heading now renders, and only the real job stamps it from the
     * configured window (the {@code ProfileAssemblerIT.seedSignal} precedent).
     */
    private UUID seedFeedback() {
        UUID owner = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "down", "too_much");
        feedbackLearningService.computeRollups(owner);
        return owner;
    }

    @Test
    void testBuildUserMessage_shouldDiscloseTheRollupWindow_whenFeedbackExists() {
        UUID owner = seedFeedback();
        PeriodSummaryEntity rung = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3, "Júliusi hónap.");

        String payload = quarterlyReviewService.buildUserMessage(owner, Q3, List.of(rung), List.of());

        // The whole rest of the payload is quarter-wide and the prompt says "csak a megadott
        // szövegekre támaszkodj" — an undisclosed heading here would let one MONTH of verdicts be
        // read as the quarter's character, and that reading becomes a durable SEASON candidate.
        // 30 is mezo.companion.feedback-learning.window-days, rendered off the row, not hardcoded.
        assertThat(payload).contains("VISSZAJELZÉSEK AZ AI-FELÜLETEKRŐL (utolsó 30 nap, nem a teljes negyedév):")
                .contains("surface:chat_message: 1 tetszik / 1 nem tetszik")
                .doesNotContain("VISSZAJELZÉSEK AZ AI-FELÜLETEKRŐL:");
    }

    @Test
    void testBuildUserMessage_shouldOmitTheWholeFeedbackHeading_whenThereAreNoVerdicts() {
        UUID owner = userPopulator.createUser().getId();
        PeriodSummaryEntity rung = periodSummaryPopulator.periodSummary(
                owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3, "Júliusi hónap.");

        String payload = quarterlyReviewService.buildUserMessage(owner, Q3, List.of(rung), List.of());

        // Honest absence: a heading with nothing under it would be a claim of its own.
        assertThat(payload).doesNotContain("VISSZAJELZÉSEK")
                .contains("EZ A NEGYEDÉV (2026-Q3):")
                .contains("nincs adat, ez az első ilyen negyedév");
    }
}
