package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonMenuMealEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonMenuMealRepository extends JpaRepository<SeasonMenuMealEntity, UUID> {

    List<SeasonMenuMealEntity> findByWeekIdOrderByMealDateAscIdAsc(UUID weekId);

    List<SeasonMenuMealEntity> findByWeekIdAndMealDate(UUID weekId, LocalDate date);

    Optional<SeasonMenuMealEntity> findByIdAndCreatedBy(UUID id, UUID owner);
}
