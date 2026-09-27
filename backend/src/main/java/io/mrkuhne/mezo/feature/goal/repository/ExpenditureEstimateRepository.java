package io.mrkuhne.mezo.feature.goal.repository;

import io.mrkuhne.mezo.feature.goal.entity.ExpenditureEstimateEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExpenditureEstimateRepository extends JpaRepository<ExpenditureEstimateEntity, UUID> {

    Optional<ExpenditureEstimateEntity> findByCreatedByAndWeekStartAndDeletedFalse(UUID createdBy, LocalDate weekStart);

    Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndWeekStartBeforeAndDeletedFalseOrderByWeekStartDesc(
        UUID createdBy, LocalDate weekStart);

    Optional<ExpenditureEstimateEntity> findFirstByCreatedByAndDeletedFalseOrderByWeekStartDesc(UUID createdBy);

    boolean existsByCreatedByAndDeletedFalse(UUID createdBy);
}
