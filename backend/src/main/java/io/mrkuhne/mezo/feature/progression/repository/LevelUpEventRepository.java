package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.LevelUpEventEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LevelUpEventRepository extends JpaRepository<LevelUpEventEntity, UUID> {

    // Idempotency lookup: a workout grants XP once per (source_type, source_ref_id).
    Optional<LevelUpEventEntity> findByCreatedByAndSourceTypeAndSourceRefId(
        UUID createdBy, String sourceType, UUID sourceRefId);
}
