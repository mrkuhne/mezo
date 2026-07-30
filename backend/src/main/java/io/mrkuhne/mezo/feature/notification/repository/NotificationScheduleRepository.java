package io.mrkuhne.mezo.feature.notification.repository;

import io.mrkuhne.mezo.feature.notification.entity.NotificationScheduleEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Owner-scoped schedule lookups. Not OwnedRepository — this entity has no `date` field. */
public interface NotificationScheduleRepository extends JpaRepository<NotificationScheduleEntity, UUID> {

    /** Every live schedule row for the owner, across all categories — the dispatcher's read. */
    List<NotificationScheduleEntity> findByCreatedBy(UUID createdBy);

    /** A single category's live rows — used by {@code replace()} to soft-delete before reinsert. */
    List<NotificationScheduleEntity> findByCreatedByAndCategory(UUID createdBy, String category);
}
