package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link PlannedSkipEntity} (Kihagyás S1, mezo-q4xt2.1). The range query backs a
 * week/day read of skips overlaid at read time by {@code PlannedSkipPolicy}; the id lookup backs
 * undo (soft delete) of a single skip, scoped to its owner.
 */
public interface PlannedSkipRepository extends JpaRepository<PlannedSkipEntity, UUID> {

    List<PlannedSkipEntity> findByCreatedByAndDateBetweenAndDeletedFalse(
        UUID createdBy, LocalDate from, LocalDate to);

    Optional<PlannedSkipEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
