package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzSmsMessageEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Ingested bank SMS; the dedupe insert (native ON CONFLICT on created_by + text_hash) arrives with the ingest. */
public interface PenzSmsMessageRepository extends JpaRepository<PenzSmsMessageEntity, UUID> {

    Optional<PenzSmsMessageEntity> findByCreatedByAndTextHashAndDeletedFalse(UUID createdBy, String textHash);
}
