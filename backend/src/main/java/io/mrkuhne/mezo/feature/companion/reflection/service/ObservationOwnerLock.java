package io.mrkuhne.mezo.feature.companion.reflection.service;

import jakarta.persistence.EntityManager;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Serializes inbox publication per owner across quick notices, nightly work and queue release. */
@Component
@RequiredArgsConstructor
public class ObservationOwnerLock {
    private final EntityManager entityManager;

    /** Caller must hold the write transaction; PostgreSQL releases this lock with that transaction. */
    public void lock(UUID owner) {
        // PostgreSQL advisory locks have no JPQL equivalent and avoid locking the auth row.
        entityManager.createNativeQuery(
                "select pg_advisory_xact_lock(hashtextextended('observations:' || cast(:owner as text), 0))")
                .setParameter("owner", owner.toString()).getSingleResult();
    }
}
