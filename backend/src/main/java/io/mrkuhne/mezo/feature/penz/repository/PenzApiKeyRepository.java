package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzApiKeyEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** SMS-ingest API keys; looked up by the SHA-256 hex of the presented key. */
public interface PenzApiKeyRepository extends JpaRepository<PenzApiKeyEntity, UUID> {

    Optional<PenzApiKeyEntity> findByKeyHashAndDeletedFalse(String keyHash);

    List<PenzApiKeyEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(UUID createdBy);

    Optional<PenzApiKeyEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Stamps the last successful use of a key (the ingest filter, without loading the entity). */
    @Modifying
    @Query(value = "update penz_api_key set last_used_at = :now where id = :id", nativeQuery = true)
    int touch(@Param("id") UUID id, @Param("now") Instant now);

    /** Revokes every live key of the owner except {@code keep} — one working key at a time (the old app's rule). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
        update penz_api_key set revoked = true
        where created_by = :createdBy and id <> :keep and revoked = false and is_deleted = false
        """, nativeQuery = true)
    int revokeOthers(@Param("createdBy") UUID createdBy, @Param("keep") UUID keep);
}
