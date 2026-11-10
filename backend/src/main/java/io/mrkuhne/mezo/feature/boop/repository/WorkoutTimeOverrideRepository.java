package io.mrkuhne.mezo.feature.boop.repository;

import io.mrkuhne.mezo.feature.boop.entity.WorkoutTimeOverrideEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutTimeOverrideRepository extends JpaRepository<WorkoutTimeOverrideEntity, UUID> {

    Optional<WorkoutTimeOverrideEntity> findByCreatedByAndDate(UUID createdBy, LocalDate date);
}
