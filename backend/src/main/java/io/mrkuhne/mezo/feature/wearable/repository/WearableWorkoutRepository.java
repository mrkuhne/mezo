package io.mrkuhne.mezo.feature.wearable.repository;

import io.mrkuhne.mezo.feature.wearable.entity.WearableWorkoutEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WearableWorkoutRepository extends JpaRepository<WearableWorkoutEntity, UUID> {

    @Query(value = "select external_id from wearable_workout where created_by = :createdBy and external_id in (:ids)",
           nativeQuery = true)
    List<String> findExistingExternalIds(@Param("createdBy") UUID createdBy, @Param("ids") Collection<String> ids);

    /** Idempotent workout write keyed by the client's external id (mezo-r36n9.2). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into wearable_workout (created_by, external_id, date, activity_type, start_at, end_at, kcal, avg_hr,
                                      source_name, distance_m, max_hr, source_bundle, is_deleted, created_at, updated_at)
        values (:createdBy, :externalId, :date, :activityType, :startAt, :endAt, :kcal, :avgHr, :sourceName,
                :distanceM, :maxHr, :sourceBundle, false, now(), now())
        on conflict on constraint uq_wearable_workout_owner_external
        do update set date = excluded.date, activity_type = excluded.activity_type, start_at = excluded.start_at,
                      end_at = excluded.end_at, kcal = excluded.kcal, avg_hr = excluded.avg_hr,
                      source_name = excluded.source_name, distance_m = excluded.distance_m, max_hr = excluded.max_hr,
                      source_bundle = excluded.source_bundle, is_deleted = false, updated_at = now()
        """, nativeQuery = true)
    void upsert(@Param("createdBy") UUID createdBy, @Param("externalId") String externalId,
                @Param("date") LocalDate date, @Param("activityType") String activityType,
                @Param("startAt") Instant startAt, @Param("endAt") Instant endAt, @Param("kcal") Integer kcal,
                @Param("avgHr") Integer avgHr, @Param("sourceName") String sourceName,
                @Param("distanceM") Integer distanceM, @Param("maxHr") Integer maxHr,
                @Param("sourceBundle") String sourceBundle);

    /** Inclusive day range, oldest first (Boop S3 brief inputs, mezo-r36n9.7). */
    List<WearableWorkoutEntity> findByCreatedByAndDateBetweenOrderByDate(UUID createdBy, LocalDate from, LocalDate to);
}
