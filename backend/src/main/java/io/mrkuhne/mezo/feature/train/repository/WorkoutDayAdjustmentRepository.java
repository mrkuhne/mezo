package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.WorkoutDayAdjustmentEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link WorkoutDayAdjustmentEntity} (proactive coaching S5, mezo-d58h.5). The
 * optional lookup backs read-time application; the list lookup backs UI display (all adjustments
 * for a user in a date range).
 */
public interface WorkoutDayAdjustmentRepository extends JpaRepository<WorkoutDayAdjustmentEntity, UUID> {

    Optional<WorkoutDayAdjustmentEntity> findByCreatedByAndDateAndDeletedFalse(
        UUID createdBy, LocalDate date);

    List<WorkoutDayAdjustmentEntity> findByCreatedByAndDateBetweenAndDeletedFalse(
        UUID createdBy, LocalDate from, LocalDate to);
}
