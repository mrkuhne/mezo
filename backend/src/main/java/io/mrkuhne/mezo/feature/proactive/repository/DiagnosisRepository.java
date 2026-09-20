package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import java.time.Instant;
import java.time.LocalDate;
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

    /** The WEEK-ANCHORED {@code weight} phenomenon's reuse lookup (mezo-85x5r): a non-stale row
     *  for the same anchor week is returned as-is — no LLM call, no quota burn. Newest first in
     *  case more than one somehow exists for the same anchor. */
    Optional<DiagnosisEntity> findFirstByCreatedByAndPhenomenonAndAnchorStartAndDeletedFalse(
            UUID createdBy, String phenomenon, LocalDate anchorStart);

    /**
     * The quota count — NATIVE on purpose: {@code @SQLRestriction} would hide soft-deleted rows,
     * so a future regenerate that soft-deletes could reset the quota by throwing rows away.
     */
    @Query(value = "select count(*) from diagnosis where created_by = :userId "
            + "and generated_at >= :from and generated_at < :to", nativeQuery = true)
    long countGeneratedOn(@Param("userId") UUID userId,
            @Param("from") Instant from, @Param("to") Instant to);
}
