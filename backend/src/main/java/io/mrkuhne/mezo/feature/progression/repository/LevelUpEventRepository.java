package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LevelUpEventRepository extends JpaRepository<LevelUpEventEntity, UUID> {

    // Idempotency lookup: a workout grants XP once per (source_type, source_ref_id).
    Optional<LevelUpEventEntity> findByCreatedByAndSourceTypeAndSourceRefId(
        UUID createdBy, String sourceType, UUID sourceRefId);

    /** Active-day feed of the consistency trait: every award timestamp since the horizon. */
    @Query("select e.occurredAt from LevelUpEventEntity e where e.createdBy = :createdBy and e.occurredAt >= :from")
    List<Instant> findOccurredAtSince(@Param("createdBy") UUID createdBy, @Param("from") Instant from);

    /** Growth-week aggregation: full events since the horizon (payload gains summed in code). */
    List<LevelUpEventEntity> findByCreatedByAndOccurredAtGreaterThanEqual(UUID createdBy, Instant from);
}
