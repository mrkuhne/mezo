package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface WaterLogRepository extends JpaRepository<WaterLogEntity, UUID> {

    Optional<WaterLogEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    @Query("select coalesce(sum(w.amountMl), 0) from WaterLogEntity w "
        + "where w.createdBy = :userId and w.logDate = :date and w.deleted = false")
    int sumAmountForDay(UUID userId, LocalDate date);
}
