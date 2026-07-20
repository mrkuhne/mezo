package io.mrkuhne.mezo.feature.intention.repository;

import io.mrkuhne.mezo.feature.intention.entity.IntentionCreedEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntentionCreedRepository extends JpaRepository<IntentionCreedEntity, UUID> {

    Optional<IntentionCreedEntity> findByCreatedByAndDeletedFalse(UUID createdBy);
}
