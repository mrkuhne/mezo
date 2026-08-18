package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.AppNotificationEntity;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppNotificationRepository extends JpaRepository<AppNotificationEntity, UUID> {

    List<AppNotificationEntity> findByCreatedByAndDeletedFalseOrderByOccurredAtDesc(
            UUID createdBy, Pageable pageable);

    List<AppNotificationEntity> findByCreatedByAndReadAtIsNullAndDeletedFalse(UUID createdBy);

    boolean existsByCreatedByAndDedupKeyAndDeletedFalse(UUID createdBy, String dedupKey);

    /** Slice F3's push-anchor read: today's events for one owner. */
    List<AppNotificationEntity> findByCreatedByAndOccurredAtBetweenAndDeletedFalse(
            UUID createdBy, Instant from, Instant to);
}
