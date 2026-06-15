package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.GymScheduleSlotEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link GymScheduleSlotEntity}. Week order = day_of_week ascending
 * (0=Hét..6=Vas), then time — the natural weekly-plan rendering order.
 */
public interface GymScheduleSlotRepository extends JpaRepository<GymScheduleSlotEntity, UUID> {

    List<GymScheduleSlotEntity> findByCreatedByAndDeletedFalseOrderByDayOfWeekAscTimeAsc(UUID createdBy);
}
