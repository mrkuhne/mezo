package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.ExerciseWeightGapEntity;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link ExerciseWeightGapEntity} (per-machine weight memory, mezo-bk7l2). */
public interface ExerciseWeightGapRepository extends JpaRepository<ExerciseWeightGapEntity, UUID> {

    List<ExerciseWeightGapEntity> findByCreatedByAndIdentityKey(UUID createdBy, String identityKey);

    Optional<ExerciseWeightGapEntity> findByCreatedByAndIdentityKeyAndWeightKg(
        UUID createdBy, String identityKey, BigDecimal weightKg);
}
