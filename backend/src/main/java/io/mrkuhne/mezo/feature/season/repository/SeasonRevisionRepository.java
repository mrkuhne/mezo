package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonRevisionEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonRevisionRepository extends JpaRepository<SeasonRevisionEntity, UUID> {

    List<SeasonRevisionEntity> findBySeasonIdOrderByCreatedAtAsc(UUID seasonId);
}
