package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagLogEntity;
import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagLogRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/** Test data factory for {@link CompanionFlagLogEntity} (W5.1, mezo-b3pp.18) — persists via
 *  {@code saveAndFlush} so the DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class FlagLogPopulator {

    private final CompanionFlagLogRepository repository;

    /** JPA-managed shared EntityManager — the {@code created_at} backdate needs a native update;
     *  field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code ResetDatabase}). */
    @PersistenceContext
    private EntityManager em;

    public CompanionFlagLogEntity raise(UUID owner, String flagKey, String source, FlagPayloadEnvelope payload) {
        CompanionFlagLogEntity e = new CompanionFlagLogEntity();
        e.setCreatedBy(owner);
        e.setFlagKey(flagKey);
        e.setSource(source);
        e.setPayload(payload);
        return repository.saveAndFlush(e);
    }

    /** A raise with a controlled timestamp — the cooldown/quiet-window tests' seam
     *  ({@code FeedbackPopulator.createVerdictAt} precedent). */
    @Transactional
    public CompanionFlagLogEntity raiseAt(
        UUID owner, String flagKey, String source, FlagPayloadEnvelope payload, Instant createdAt) {
        CompanionFlagLogEntity e = raise(owner, flagKey, source, payload);
        em.createNativeQuery("update companion_flag_log set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", e.getId()).executeUpdate();
        em.clear();
        return repository.findById(e.getId()).orElseThrow();
    }

    /** Inserts natively, so a bad flag_key/source reaches the DB CHECK instead of being stopped by
     *  the entity's mirroring {@code @Pattern} — the CHECKs are what this pins. */
    @Transactional
    public void rawInsert(UUID owner, String flagKey, String source) {
        em.createNativeQuery(
                "insert into companion_flag_log (created_by, flag_key, source) values (:owner, :key, :src)")
            .setParameter("owner", owner).setParameter("key", flagKey).setParameter("src", source)
            .executeUpdate();
        em.flush();
    }
}
