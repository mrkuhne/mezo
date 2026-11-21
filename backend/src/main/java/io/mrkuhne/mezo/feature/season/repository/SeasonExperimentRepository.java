package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonExperimentEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonExperimentRepository extends JpaRepository<SeasonExperimentEntity, UUID> {

    Optional<SeasonExperimentEntity> findByIdAndCreatedBy(UUID id, UUID owner);

    /** At most one running / one proposed per owner (partial unique indexes); a list so a race never throws here. */
    List<SeasonExperimentEntity> findByCreatedByAndStatus(UUID owner, String status);

    /** The season's proposed / running rows — what the Hatás tab, the detector and the context read. */
    List<SeasonExperimentEntity> findBySeasonIdAndStatus(UUID seasonId, String status);

    List<SeasonExperimentEntity> findBySeasonIdOrderByCreatedAtDesc(UUID seasonId);

    /** The kept experiments of a season — the „Szokás (kísérletből megtartva)” rule lines. */
    List<SeasonExperimentEntity> findBySeasonIdAndKeptTrueOrderByCreatedAtAsc(UUID seasonId);
}
