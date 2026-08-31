package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DiagnosisRepository extends JpaRepository<DiagnosisEntity, UUID> {

    Optional<DiagnosisEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<DiagnosisEntity> findByCreatedByAndPhenomenonOrderByGeneratedAtDesc(
            UUID createdBy, String phenomenon);

    /**
     * The quota count — NATIVE on purpose: {@code @SQLRestriction} would hide soft-deleted rows,
     * so a future regenerate that soft-deletes could reset the quota by throwing rows away.
     */
    @Query(value = "select count(*) from diagnosis where created_by = :userId "
            + "and generated_at >= :from and generated_at < :to", nativeQuery = true)
    long countGeneratedOn(@Param("userId") UUID userId,
            @Param("from") Instant from, @Param("to") Instant to);
}
