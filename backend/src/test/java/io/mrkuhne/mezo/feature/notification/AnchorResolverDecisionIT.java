package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.feature.notification.domain.AnchorSet;
import io.mrkuhne.mezo.feature.notification.domain.NotificationCategory;
import io.mrkuhne.mezo.feature.notification.service.AnchorResolver;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** decision_review anchoring (bd mezo-b3pp.4, spec §5.4): the push exists on the due day only,
 *  and only while the decision is still unreviewed. */
class AnchorResolverDecisionIT extends AbstractIntegrationTest {

    private static final LocalDate DUE_DAY = LocalDate.parse("2026-08-20");

    @Autowired private AnchorResolver anchorResolver;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private DecisionEntryRepository decisionEntryRepository;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testResolve_shouldYieldADecisionReviewAnchor_whenAnUnreviewedDecisionIsDueThatDay() {
        UUID owner = userPopulator.createUser("anchor-decision-due@test.local").getId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Esti edzésre váltok a reggeli helyett.", DUE_DAY, "ctx");

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        assertThat(anchors.backendAnchors())
            .filteredOn(e -> e.category() == NotificationCategory.DECISION_REVIEW)
            .singleElement()
            .satisfies(e -> {
                assertThat(e.minuteOfDay()).isEqualTo(9 * 60);
                assertThat(e.title()).isNotBlank();
                assertThat(e.body()).contains("Esti edzésre váltok");
                assertThat(e.url()).isEqualTo("/me/naplo");
            });
    }

    @Test
    void testResolve_shouldYieldNoDecisionReviewAnchor_whenTheDecisionIsAlreadyReviewed() {
        UUID owner = userPopulator.createUser("anchor-decision-done@test.local").getId();
        DecisionEntryEntity decision = journalPopulator.createDecision(owner,
            LocalDate.parse("2026-07-21"), "Már átnéztem.", DUE_DAY, "ctx");
        decision.setReviewedAt(Instant.parse("2026-08-19T18:00:00Z"));
        decision.setOutcomeRating((short) 4);
        decisionEntryRepository.saveAndFlush(decision);

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        assertThat(anchors.backendAnchors())
            .noneMatch(e -> e.category() == NotificationCategory.DECISION_REVIEW);
    }

    @Test
    void testResolve_shouldYieldNoDecisionReviewAnchor_whenTheDueDayHasPassed() {
        UUID owner = userPopulator.createUser("anchor-decision-overdue@test.local").getId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-01"),
            "Régóta esedékes.", LocalDate.parse("2026-08-01"), "ctx");

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        // Deliberate: the /me/naplo chip carries an overdue decision, not a push that nags daily.
        assertThat(anchors.backendAnchors())
            .noneMatch(e -> e.category() == NotificationCategory.DECISION_REVIEW);
    }

    @Test
    void testResolve_shouldYieldOneAnchorPerDecision_whenTwoAreDueTheSameDay() {
        UUID owner = userPopulator.createUser("anchor-decision-two@test.local").getId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"), "Egyik.", DUE_DAY, "ctx");
        journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"), "Másik.", DUE_DAY, "ctx");

        AnchorSet anchors = anchorResolver.resolve(owner, DUE_DAY);

        var decisionAnchors = anchors.backendAnchors().stream()
            .filter(e -> e.category() == NotificationCategory.DECISION_REVIEW).toList();
        assertThat(decisionAnchors).hasSize(2);
        // Distinct dedup suffixes, or push_log's day-scoped dedup would collapse them into one push.
        assertThat(decisionAnchors).extracting(AnchorSet.AnchoredEvent::dedupSuffix)
            .doesNotHaveDuplicates();
    }
}
