package io.mrkuhne.mezo.feature.meal.repository;

import org.springframework.data.jpa.repository.Modifying;
import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WaterLogRepository extends JpaRepository<WaterLogEntity, UUID> {

    Optional<WaterLogEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    @Query("select coalesce(sum(w.amountMl), 0) from WaterLogEntity w "
        + "where w.createdBy = :userId and w.logDate = :date and w.deleted = false")
    int sumAmountForDay(UUID userId, LocalDate date);

    /**
     * Per-day water totals in {@code [from, to]} — one grouped query instead of a per-day
     * {@link #sumAmountForDay} loop (Karakter round 2). Each row is {@code [LocalDate, Long]};
     * days with no log are simply absent (never a 0 row).
     */
    @Query("select w.logDate, sum(w.amountMl) from WaterLogEntity w "
        + "where w.createdBy = :userId and w.deleted = false "
        + "and w.logDate between :from and :to group by w.logDate order by w.logDate asc")
    List<Object[]> sumsBetween(@Param("userId") UUID userId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to);

    Optional<WaterLogEntity> findByCreatedByAndClientRefAndDeletedFalse(UUID createdBy, UUID clientRef);

    /** Race-safe insert for a Boop retry (see {@code MealRepository#insertIfClientRefAbsent}); 1 = created. */
    @Modifying(flushAutomatically = true)
    @Query(value = """
        insert into water_log (created_by, log_date, amount_ml, client_ref)
        values (:createdBy, :logDate, :amountMl, :clientRef)
        on conflict (created_by, client_ref) where client_ref is not null and is_deleted = false do nothing
        """, nativeQuery = true)
    int insertIfClientRefAbsent(@Param("createdBy") UUID createdBy, @Param("logDate") LocalDate logDate,
                                @Param("amountMl") int amountMl, @Param("clientRef") UUID clientRef);
}
