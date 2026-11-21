package io.mrkuhne.mezo.feature.wearable.repository;

import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CalendarEventRepository extends JpaRepository<CalendarEventEntity, UUID> {

    /** Upsert by (owner, external id, date): revives a cancelled row, refreshes the fields (mezo-r36n9.11, .17). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into calendar_event (id, created_by, external_id, date, title, start_at, end_at, all_day, calendar_name,
            attendee_count, attendee_names, organizer_is_me, location, recurring, availability, notes)
        values (gen_random_uuid(), :createdBy, :externalId, :date, :title, :startAt, :endAt, :allDay, :calendarName,
            :attendeeCount, cast(:attendeeNames as jsonb), :organizerIsMe, :location, :recurring, :availability, :notes)
        on conflict (created_by, external_id, date) do update set
            is_deleted = false, title = excluded.title, start_at = excluded.start_at, end_at = excluded.end_at,
            all_day = excluded.all_day, calendar_name = excluded.calendar_name,
            attendee_count = excluded.attendee_count, attendee_names = excluded.attendee_names,
            organizer_is_me = excluded.organizer_is_me, location = excluded.location, recurring = excluded.recurring,
            availability = excluded.availability, notes = excluded.notes, updated_at = now()
        """, nativeQuery = true)
    void upsert(@Param("createdBy") UUID createdBy, @Param("externalId") String externalId,
                @Param("date") LocalDate date, @Param("title") String title, @Param("startAt") Instant startAt,
                @Param("endAt") Instant endAt, @Param("allDay") boolean allDay,
                @Param("calendarName") String calendarName, @Param("attendeeCount") Integer attendeeCount,
                @Param("attendeeNames") String attendeeNamesJson, @Param("organizerIsMe") Boolean organizerIsMe,
                @Param("location") String location, @Param("recurring") Boolean recurring,
                @Param("availability") String availability, @Param("notes") String notes);

    /** Soft-deletes the day's live rows whose external id is not in {@code keep} (cancelled events). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        update calendar_event set is_deleted = true, updated_at = now()
        where created_by = :createdBy and date = :date and is_deleted = false
          and external_id not in (:keep)
        """, nativeQuery = true)
    void softDeleteMissing(@Param("createdBy") UUID createdBy, @Param("date") LocalDate date,
                           @Param("keep") Collection<String> keep);

    /** Soft-deletes every live row of the day (empty payload for that day). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        update calendar_event set is_deleted = true, updated_at = now()
        where created_by = :createdBy and date = :date and is_deleted = false
        """, nativeQuery = true)
    void softDeleteDay(@Param("createdBy") UUID createdBy, @Param("date") LocalDate date);

    /** Live (not cancelled / soft-deleted) events of the day. */
    List<CalendarEventEntity> findByCreatedByAndDeletedFalseAndDateOrderByStartAt(UUID createdBy, LocalDate date);
}
