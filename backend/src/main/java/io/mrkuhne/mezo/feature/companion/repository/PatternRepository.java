package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PatternRepository extends JpaRepository<PatternEntity, UUID> {

    /** The inbox read — freshest detection first. */
    List<PatternEntity> findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(UUID createdBy);

    /** The nightly upsert probe — one live row per (user, kind, pair). */
    Optional<PatternEntity> findByCreatedByAndKindAndPairKeyAndDeletedFalse(
            UUID createdBy, String kind, String pairKey);

    /** Ownership gate (404 for missing OR foreign — the house idiom). */
    Optional<PatternEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** Status-scoped read — recentlyConfirmed on the FE, V3.3 promotion/reinforcement. */
    List<PatternEntity> findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
            UUID createdBy, String status);

    /** All promoting patterns of a user — the V3.3 fact→pattern evidence-link batch map. */
    List<PatternEntity> findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(UUID createdBy);
}
