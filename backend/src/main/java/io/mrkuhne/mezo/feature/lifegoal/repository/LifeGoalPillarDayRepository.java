package io.mrkuhne.mezo.feature.lifegoal.repository;

import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalPillarDayEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LifeGoalPillarDayRepository extends JpaRepository<LifeGoalPillarDayEntity, UUID> {
    Optional<LifeGoalPillarDayEntity> findByPillarIdAndDayAndDeletedFalse(UUID pillarId, LocalDate day);
    List<LifeGoalPillarDayEntity> findByPillarIdInAndDayBetweenAndDeletedFalseOrderByDayAsc(
        List<UUID> pillarIds, LocalDate from, LocalDate to);
}
