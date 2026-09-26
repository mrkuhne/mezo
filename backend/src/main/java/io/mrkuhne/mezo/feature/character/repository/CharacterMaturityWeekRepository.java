package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterMaturityWeekEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterMaturityWeekRepository extends JpaRepository<CharacterMaturityWeekEntity, UUID> {

    Optional<CharacterMaturityWeekEntity> findByCreatedByAndDimensionIdAndWeekStart(
            UUID createdBy, UUID dimensionId, LocalDate weekStart);

    List<CharacterMaturityWeekEntity> findByCreatedByAndWeekStartBetweenOrderByWeekStartAsc(
            UUID createdBy, LocalDate from, LocalDate to);
}
