package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.MessageFeedbackRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/** Test data factory for {@link MessageFeedbackEntity} — persists via {@code saveAndFlush}
 *  so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class FeedbackPopulator {

    private final MessageFeedbackRepository repository;

    /** JPA-managed shared EntityManager — the {@code @CreationTimestamp} backdate needs a native
     *  update; field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code ResetDatabase}). */
    @PersistenceContext
    private EntityManager em;

    public MessageFeedbackEntity createVerdict(UUID owner, String kind, UUID artifactId, String verdict, String reason) {
        MessageFeedbackEntity e = new MessageFeedbackEntity();
        e.setCreatedBy(owner);
        e.setArtifactKind(kind);
        e.setArtifactId(artifactId);
        e.setVerdict(verdict);
        e.setReason(reason);
        return repository.saveAndFlush(e);
    }

    /** A verdict with a controlled timestamp, for deterministic rollup-window tests (W4.2,
     *  mezo-b3pp.16) — the {@code WeightLogPopulator.createWeightLogAt} precedent. Backdates
     *  {@code updated_at} TOO, not just {@code created_at}: a row voted once and never touched
     *  since has both stamps equal (that is exactly what {@code upsertVerdict}'s insert branch
     *  writes), and {@code FeedbackLearningService} windows on {@code updated_at}. */
    @Transactional
    public MessageFeedbackEntity createVerdictAt(
        UUID owner, String kind, UUID artifactId, String verdict, String reason, Instant createdAt) {
        MessageFeedbackEntity e = createVerdict(owner, kind, artifactId, verdict, reason);
        em.createNativeQuery("update message_feedback set created_at = :at, updated_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return repository.findById(e.getId()).orElseThrow();
    }

    /** Re-votes on an existing artifact through the REAL write path
     *  ({@code MessageFeedbackRepository.upsertVerdict}'s {@code on conflict do update}), which
     *  bumps {@code updated_at} to {@code now()} while leaving {@code created_at} untouched —
     *  {@link #createVerdict} is a plain insert and would collide on
     *  {@code uq_message_feedback_artifact} instead. */
    @Transactional
    public MessageFeedbackEntity revote(UUID owner, String kind, UUID artifactId, String verdict, String reason) {
        repository.upsertVerdict(owner, kind, artifactId, verdict, reason);
        em.clear();
        return repository.findByCreatedByAndArtifactKindAndArtifactIdAndDeletedFalse(owner, kind, artifactId)
            .orElseThrow();
    }
}
