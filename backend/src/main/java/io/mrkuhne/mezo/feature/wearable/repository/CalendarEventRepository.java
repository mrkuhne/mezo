package io.mrkuhne.mezo.feature.wearable.repository;

import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CalendarEventRepository extends JpaRepository<CalendarEventEntity, UUID> {

    /** Hard delete — calendar rows are a per-day snapshot, not history (mezo-r36n9.2). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "delete from calendar_event where created_by = :createdBy and date = :date", nativeQuery = true)
    void deleteDay(@Param("createdBy") UUID createdBy, @Param("date") LocalDate date);

    List<CalendarEventEntity> findByCreatedByAndDateOrderByStartAt(UUID createdBy, LocalDate date);

    /** Live (not cancelled / soft-deleted) events of the day. */
    List<CalendarEventEntity> findByCreatedByAndDeletedFalseAndDateOrderByStartAt(UUID createdBy, LocalDate date);
}
