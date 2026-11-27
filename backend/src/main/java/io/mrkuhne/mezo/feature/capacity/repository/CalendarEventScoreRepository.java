package io.mrkuhne.mezo.feature.capacity.repository;

import io.mrkuhne.mezo.feature.capacity.entity.CalendarEventScoreEntity;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CalendarEventScoreRepository extends JpaRepository<CalendarEventScoreEntity, UUID> {
    List<CalendarEventScoreEntity> findByEventId(UUID eventId);

    List<CalendarEventScoreEntity> findByCreatedByAndEventIdIn(UUID createdBy, Collection<UUID> eventIds);

    /** Owners whose events were scored since {@code since} (the nightly learning pass's owners, Boop B7 K4). */
    @Query("select distinct s.createdBy from CalendarEventScoreEntity s where s.updatedAt >= :since")
    List<UUID> ownersSince(@Param("since") java.time.Instant since);
}
