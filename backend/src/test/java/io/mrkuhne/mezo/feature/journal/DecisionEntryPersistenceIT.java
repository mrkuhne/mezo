package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.validation.ConstraintViolationException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** decision_entry DDL + jsonb envelope round-trip + rating CHECK + the anchor finder (bd mezo-b3pp.4). */
@Transactional
class DecisionEntryPersistenceIT extends AbstractIntegrationTest {

    @Autowired private DecisionEntryRepository repository;
    @Autowired private JournalPopulator populator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testCreateDecision_shouldRoundTripTheJsonbSnapshot_whenValid() {
        UUID owner = userPopulator.createUser("decision-rt@test.local").getId();

        DecisionEntryEntity saved = populator.createDecision(owner, LocalDate.parse("2026-08-20"),
            "Elhalasztom a nyári blokkot szeptemberre.", LocalDate.parse("2026-09-19"),
            "[Profil] 183 cm ...");

        DecisionEntryEntity found = repository
            .findByIdAndCreatedByAndDeletedFalse(saved.getId(), owner).orElseThrow();
        assertThat(found.getDecisionText()).isEqualTo("Elhalasztom a nyári blokkot szeptemberre.");
        assertThat(found.getContextSnapshot().snapshotText()).isEqualTo("[Profil] 183 cm ...");
        assertThat(found.getContextSnapshot().capturedAt()).isNotNull();
        assertThat(found.getReviewDue()).isEqualTo(LocalDate.parse("2026-09-19"));
        assertThat(found.getReviewedAt()).isNull();
        assertThat(found.getOutcomeRating()).isNull();
    }

    @Test
    void testFindByReviewDue_shouldReturnOnlyUnreviewedDecisionsDueThatExactDay_whenMixed() {
        UUID owner = userPopulator.createUser("decision-due@test.local").getId();
        DecisionEntryEntity dueToday = populator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Ma esedékes.", LocalDate.parse("2026-08-20"), "ctx");
        populator.createDecision(owner, LocalDate.parse("2026-07-22"),
            "Holnap esedékes.", LocalDate.parse("2026-08-21"), "ctx");
        DecisionEntryEntity alreadyReviewed = populator.createDecision(owner,
            LocalDate.parse("2026-07-20"), "Már átnézve.", LocalDate.parse("2026-08-20"), "ctx");
        alreadyReviewed.setReviewedAt(java.time.Instant.parse("2026-08-20T07:00:00Z"));
        alreadyReviewed.setOutcomeRating((short) 4);
        repository.saveAndFlush(alreadyReviewed);

        List<DecisionEntryEntity> due = repository
            .findByCreatedByAndReviewDueAndReviewedAtIsNullAndDeletedFalse(owner, LocalDate.parse("2026-08-20"));

        assertThat(due).extracting(DecisionEntryEntity::getId).containsExactly(dueToday.getId());
    }

    @Test
    void testSaveDecision_shouldRejectTheRating_whenOutsideOneToFive() {
        UUID owner = userPopulator.createUser("decision-ck@test.local").getId();
        DecisionEntryEntity e = populator.createDecision(owner, LocalDate.parse("2026-08-20"),
            "Rossz értékelés.", LocalDate.parse("2026-09-19"), "ctx");
        e.setOutcomeRating((short) 9);

        // the entity's @Min/@Max guard fires before the DB CHECK (ck_decision_entry_outcome_rating)
        // is ever reached — the JournalEntryPersistenceIT#testSource_* precedent, same distinction
        assertThatThrownBy(() -> repository.saveAndFlush(e))
            .isInstanceOf(ConstraintViolationException.class);
    }
}
