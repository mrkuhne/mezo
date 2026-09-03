package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.WorkoutTimingProfileEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkoutTimingProfileRepository extends JpaRepository<WorkoutTimingProfileEntity, UUID> {

    List<WorkoutTimingProfileEntity> findByCreatedBy(UUID createdBy);

    Optional<WorkoutTimingProfileEntity> findByCreatedByAndComponent(UUID createdBy, String component);
}
