package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChallengeRepository extends JpaRepository<ChallengeEntity, UUID> {

    /** The card read: all challenges for one planned session/date, oldest first (live via @SQLRestriction). */
    List<ChallengeEntity> findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(
        UUID createdBy, UUID templateSessionId, LocalDate workoutDate);

    /** The decide path's owned lookup. */
    Optional<ChallengeEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);

    /** The outcome run's read: challenges in a given status for a user. */
    List<ChallengeEntity> findByCreatedByAndStatus(UUID createdBy, String status);
}
