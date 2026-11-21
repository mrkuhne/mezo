package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CalendarEventScoreEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarEventScoreRepository extends JpaRepository<CalendarEventScoreEntity, UUID> {
    List<CalendarEventScoreEntity> findByEventId(UUID eventId);
}
