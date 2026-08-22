package io.mrkuhne.mezo.feature.companion.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class FeedbackRollupPersistenceIT extends AbstractIntegrationTest {

    @Autowired private FeedbackRollupRepository feedbackRollupRepository;
    @Autowired private UserPopulator userPopulator;

    /** JPA-managed shared EntityManager — the DB-CHECK case needs a native insert to get around
     *  the entity's {@code @Pattern}; field-injected {@code @PersistenceContext} is the house
     *  exception to constructor DI (see {@code ResetDatabase}/{@code FeedbackPopulator}). */
    @PersistenceContext private EntityManager em;

    private FeedbackRollupEntity newRow(UUID owner, String scope) {
        FeedbackRollupEntity e = new FeedbackRollupEntity();
        e.setCreatedBy(owner);
        e.setScope(scope);
        e.setWindowDays(30);
        e.setStats(FeedbackRollupStatsEnvelope.effectiveness(3, 1));
        e.setComputedAt(Instant.now());
        return e;
    }

    @Test
    void testSave_shouldRoundTripEffectivenessStats_whenScopeIsSurface() {
        UUID owner = userPopulator.createUser().getId();

        FeedbackRollupEntity saved = feedbackRollupRepository.saveAndFlush(
            newRow(owner, "surface:chat_message"));

        FeedbackRollupEntity found = feedbackRollupRepository
            .findByCreatedByAndScopeAndWindowDaysAndDeletedFalse(owner, "surface:chat_message", 30)
            .orElseThrow();
        assertThat(found.getId()).isEqualTo(saved.getId());
        assertThat(found.getStats().up()).isEqualTo(3);
        assertThat(found.getStats().down()).isEqualTo(1);
        assertThat(found.getStats().total()).isEqualTo(4);
        assertThat(found.getStats().bySurface()).isNull();
    }

    @Test
    void testSave_shouldReject_whenScopeMatchesNoPrefix() {
        UUID owner = userPopulator.createUser().getId();
        FeedbackRollupEntity bad = newRow(owner, "nonsense");

        // the entity's @Pattern guard fires before the DB CHECK
        assertThatThrownBy(() -> feedbackRollupRepository.saveAndFlush(bad))
            .isInstanceOf(ConstraintViolationException.class);
    }

    /** The entity's {@code @Pattern} short-circuits every JPA write, so the DB CHECK itself is only
     *  reachable by going around bean validation with raw SQL — this is the case that proves the
     *  constraint really is in the schema and not just in the entity. */
    @Test
    void testNativeInsert_shouldViolateScopeCheck_whenBeanValidationIsBypassed() {
        UUID owner = userPopulator.createUser().getId();

        assertThatThrownBy(() -> em.createNativeQuery("""
                insert into feedback_rollup (created_by, scope, window_days, stats, computed_at)
                values (:owner, 'nonsense', 30, cast(:stats as jsonb), now())
                """)
            .setParameter("owner", owner)
            .setParameter("stats", "{\"up\": 3, \"down\": 1}")
            .executeUpdate())
            .hasStackTraceContaining("ck_feedback_rollup_scope");
    }

    @Test
    void testSave_shouldReject_whenSecondRowCollidesOnScopeIdentity() {
        UUID owner = userPopulator.createUser().getId();
        feedbackRollupRepository.saveAndFlush(newRow(owner, "surface:memoir"));

        assertThatThrownBy(() -> feedbackRollupRepository.saveAndFlush(newRow(owner, "surface:memoir")))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
