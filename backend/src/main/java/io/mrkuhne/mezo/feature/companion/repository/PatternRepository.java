package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
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

    /** S4 (mezo-eq85.4): the Észrevételek feed's `watching` group — status-scoped AND kind-scoped
     *  in SQL, so a statistical catalog row the Pearson job owns can never reach that surface. */
    List<PatternEntity> findByCreatedByAndKindInAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
            UUID createdBy, Collection<String> kinds, String status);

    /** S2 (mezo-eq85.2): the hypothesis-identity probe — one live row per (user, hypothesis key). */
    Optional<PatternEntity> findByCreatedByAndHypothesisKeyAndDeletedFalse(
            UUID createdBy, String hypothesisKey);

    /** S2: the nightly evaluation's work list — every row still open to the engine. */
    List<PatternEntity> findByCreatedByAndStatusInAndDeletedFalse(
            UUID createdBy, Collection<String> statuses);

    /** All promoting patterns of a user — the V3.3 fact→pattern evidence-link batch map. */
    List<PatternEntity> findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(UUID createdBy);
}
