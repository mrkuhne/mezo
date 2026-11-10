package io.mrkuhne.mezo.feature.boop.repository;

import io.mrkuhne.mezo.feature.boop.entity.WorkoutTimeOverrideEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import java.time.LocalTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkoutTimeOverrideRepository extends JpaRepository<WorkoutTimeOverrideEntity, UUID> {

    Optional<WorkoutTimeOverrideEntity> findByCreatedByAndDate(UUID createdBy, LocalDate date);

    /** Atomic last-write-wins upsert on the partial unique index (live rows only): two racing first
     *  writes cannot violate it. Run inside a transaction. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(nativeQuery = true, value = """
        insert into workout_time_override (id, created_by, date, time)
        values (gen_random_uuid(), :owner, :date, :time)
        on conflict (created_by, date) where is_deleted = false
        do update set time = excluded.time
        """)
    int upsert(@Param("owner") UUID owner, @Param("date") LocalDate date, @Param("time") LocalTime time);
}
