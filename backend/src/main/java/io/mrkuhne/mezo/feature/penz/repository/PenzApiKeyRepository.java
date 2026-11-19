package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzApiKeyEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** SMS-ingest API keys; looked up by the SHA-256 hex of the presented key. */
public interface PenzApiKeyRepository extends JpaRepository<PenzApiKeyEntity, UUID> {

    Optional<PenzApiKeyEntity> findByKeyHashAndDeletedFalse(String keyHash);

    List<PenzApiKeyEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    Optional<PenzApiKeyEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
