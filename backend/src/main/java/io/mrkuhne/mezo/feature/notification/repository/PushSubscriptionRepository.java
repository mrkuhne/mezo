package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.PushSubscriptionEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owner-scoped subscription lookups. Not OwnedRepository — this entity has no `date` field. */
public interface PushSubscriptionRepository extends JpaRepository<PushSubscriptionEntity, UUID> {

    List<PushSubscriptionEntity> findByCreatedBy(UUID createdBy);

    Optional<PushSubscriptionEntity> findByCreatedByAndEndpoint(UUID createdBy, String endpoint);

    /** Every live row for this endpoint regardless of owner — the S6 re-bind reads it. */
    List<PushSubscriptionEntity> findByEndpoint(String endpoint);
}
