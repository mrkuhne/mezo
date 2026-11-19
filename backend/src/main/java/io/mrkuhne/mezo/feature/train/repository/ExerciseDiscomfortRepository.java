package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseDiscomfortEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

// No 'date' base field => JpaRepository directly, not OwnedRepository.
public interface ExerciseDiscomfortRepository extends JpaRepository<ExerciseDiscomfortEntity, UUID> {

    Optional<ExerciseDiscomfortEntity> findByCreatedByAndIdentityKeyAndNotedOn(
        UUID createdBy, String identityKey, LocalDate notedOn);

    List<ExerciseDiscomfortEntity> findByCreatedByAndNotedOnGreaterThanEqual(UUID createdBy, LocalDate from);
}
