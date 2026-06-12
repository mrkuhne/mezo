package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.SportScheduleSlotEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link SportScheduleSlotEntity}. Week order = day_of_week ascending
 * (0=Hét..6=Vas), then time — the natural weekly-plan rendering order.
 */
public interface SportScheduleSlotRepository extends JpaRepository<SportScheduleSlotEntity, UUID> {

    List<SportScheduleSlotEntity> findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID createdBy);
}
