package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.TeamEditionEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamEditionRepository extends JpaRepository<TeamEditionEntity, UUID> {

    Optional<TeamEditionEntity> findByCreatedByAndDay(UUID createdBy, LocalDate day);

    List<TeamEditionEntity> findByCreatedByAndDayBetweenOrderByDayDesc(UUID createdBy, LocalDate from, LocalDate to);

    Optional<TeamEditionEntity> findFirstByCreatedByAndDayLessThanOrderByDayDesc(UUID createdBy, LocalDate day);
}
