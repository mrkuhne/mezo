package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CapacityEventFeedbackEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CapacityEventFeedbackRepository extends JpaRepository<CapacityEventFeedbackEntity, UUID> {
    List<CapacityEventFeedbackEntity> findByCreatedByAndDeletedFalse(UUID owner);

    /**
     * One label per (owner, event key): a native upsert, because {@code @SQLRestriction} hides a soft-deleted row
     * from JPA while the unique constraint still covers it — a deleted label is revived, not duplicated.
     */
    @Modifying
    @Query(value = """
        insert into capacity_event_feedback (created_by, event_key, effect)
        values (:owner, :eventKey, :effect)
        on conflict (created_by, event_key)
        do update set effect = excluded.effect, is_deleted = false, updated_at = now()
        """, nativeQuery = true)
    void upsert(@Param("owner") UUID owner, @Param("eventKey") String eventKey, @Param("effect") String effect);
}
