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

    /** A verdict with a controlled {@code created_at}, for deterministic rollup-window tests
     *  (W4.2, mezo-b3pp.16) — the {@code WeightLogPopulator.createWeightLogAt} precedent. */
    @Transactional
    public MessageFeedbackEntity createVerdictAt(
        UUID owner, String kind, UUID artifactId, String verdict, String reason, Instant createdAt) {
        MessageFeedbackEntity e = createVerdict(owner, kind, artifactId, verdict, reason);
        em.createNativeQuery("update message_feedback set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return repository.findById(e.getId()).orElseThrow();
    }
}
