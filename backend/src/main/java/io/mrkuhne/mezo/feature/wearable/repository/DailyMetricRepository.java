package io.mrkuhne.mezo.feature.wearable.repository;

import io.mrkuhne.mezo.feature.wearable.entity.DailyMetricEntity;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyMetricRepository extends JpaRepository<DailyMetricEntity, UUID> {

    @Query(value = "select date from daily_metric where created_by = :createdBy and date in (:dates)", nativeQuery = true)
    List<LocalDate> findExistingDates(@Param("createdBy") UUID createdBy, @Param("dates") Collection<LocalDate> dates);

    /** Idempotent day write: a re-sent day replaces every metric column (mezo-r36n9.2). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        insert into daily_metric (created_by, date, steps, resting_hr, avg_hr, min_hr, max_hr, active_kcal,
                                  is_deleted, created_at, updated_at)
        values (:createdBy, :date, :steps, :restingHr, :avgHr, :minHr, :maxHr, :activeKcal, false, now(), now())
        on conflict on constraint uq_daily_metric_owner_date
        do update set steps = excluded.steps, resting_hr = excluded.resting_hr, avg_hr = excluded.avg_hr,
                      min_hr = excluded.min_hr, max_hr = excluded.max_hr, active_kcal = excluded.active_kcal,
                      is_deleted = false, updated_at = now()
        """, nativeQuery = true)
    void upsert(@Param("createdBy") UUID createdBy, @Param("date") LocalDate date, @Param("steps") Integer steps,
                @Param("restingHr") Integer restingHr, @Param("avgHr") Integer avgHr, @Param("minHr") Integer minHr,
                @Param("maxHr") Integer maxHr, @Param("activeKcal") Integer activeKcal);
}
