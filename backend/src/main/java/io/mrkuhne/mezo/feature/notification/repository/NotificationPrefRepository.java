package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.NotificationPrefEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owner-scoped preference lookups. Not OwnedRepository — this entity has no `date` field. */
public interface NotificationPrefRepository extends JpaRepository<NotificationPrefEntity, UUID> {

    List<NotificationPrefEntity> findByCreatedBy(UUID createdBy);

    Optional<NotificationPrefEntity> findByCreatedByAndCategory(UUID createdBy, String category);
}
