package io.mrkuhne.mezo.feature.season.repository;

import io.mrkuhne.mezo.feature.season.entity.SeasonMenuWeekEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeasonMenuWeekRepository extends JpaRepository<SeasonMenuWeekEntity, UUID> {

    Optional<SeasonMenuWeekEntity> findByCreatedByAndWeekStart(UUID owner, LocalDate weekStart);

    Optional<SeasonMenuWeekEntity> findByIdAndCreatedBy(UUID id, UUID owner);

    /** Approved weeks overlapping {@code from..to} (week starts {@code from-6..to}). */
    List<SeasonMenuWeekEntity> findByCreatedByAndStatusAndWeekStartBetween(
        UUID owner, String status, LocalDate fromStart, LocalDate toStart);
}
