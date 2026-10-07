package io.mrkuhne.mezo.feature.auth.repository;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LearningPauseRepository extends JpaRepository<LearningPauseEntity, UUID> {

    /** The row with no {@code endedAt} — at most one per user (uq_learning_pause_one_open). It may
     *  already be past its planned end; the service decides whether it still applies. */
    @Query("select p from LearningPauseEntity p where p.createdBy = :user and p.endedAt is null")
    Optional<LearningPauseEntity> findOpen(@Param("user") UUID user);

    /** Intervals in effect at any instant of {@code [from, to)}. */
    @Query("select p from LearningPauseEntity p where p.createdBy = :user and p.startedAt < :to"
            + " and (coalesce(p.endedAt, p.plannedEndAt) is null or coalesce(p.endedAt, p.plannedEndAt) > :from)"
            + " order by p.startedAt")
    List<LearningPauseEntity> overlapping(@Param("user") UUID user, @Param("from") Instant from,
            @Param("to") Instant to);

    /** Timed pauses past their planned end that the sweep has not stamped yet (all users). */
    @Query("select p from LearningPauseEntity p where p.endedAt is null and p.plannedEndAt is not null"
            + " and p.plannedEndAt <= :now")
    List<LearningPauseEntity> expiredOpen(@Param("now") Instant now);

    /** Open-ended pauses started before {@code before} that were never reminded (all users). */
    @Query("select p from LearningPauseEntity p where p.endedAt is null and p.plannedEndAt is null"
            + " and p.remindedAt is null and p.startedAt <= :before")
    List<LearningPauseEntity> openEndedOlderThan(@Param("before") Instant before);
}
