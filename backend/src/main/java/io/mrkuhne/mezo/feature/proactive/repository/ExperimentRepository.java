package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExperimentRepository extends JpaRepository<ExperimentEntity, UUID> {

    /** The decide path's owned lookup. */
    Optional<ExperimentEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    /** The GET's read: live rows (proposed/active/completed), newest first (dismissed excluded). */
    List<ExperimentEntity> findByCreatedByAndStatusInOrderByGeneratedAtDesc(
            UUID createdBy, Collection<String> statuses);

    /** The outcome run's read: all active experiments. */
    List<ExperimentEntity> findByCreatedByAndStatusOrderByGeneratedAtDesc(UUID createdBy, String status);

    /** The propose cap: how many open (proposed + active) experiments the user already has. */
    long countByCreatedByAndStatusIn(UUID createdBy, Collection<String> statuses);

    /** S2 (mezo-tk88.2): the pattern-detail page's impact list — experiments grounded on one pattern. */
    List<ExperimentEntity> findByCreatedByAndSourcePatternIdAndDeletedFalse(UUID createdBy, UUID sourcePatternId);

    /** Duplicate guard for the diagnosis hand-off (mezo-hqfi.3): one open experiment per metric. */
    Optional<ExperimentEntity> findFirstByCreatedByAndMetricKeyAndStatusInAndDeletedFalse(
            UUID createdBy, String metricKey, List<String> statuses);

    /** Prior-experiment context for the diagnosis gather — what was already tried, and how it went. */
    List<ExperimentEntity> findByCreatedByAndSourceAndDeletedFalseOrderByGeneratedAtDesc(
            UUID createdBy, String source);

    /** Karakter round-4 read layer (CharacterMetaReads): window read, bounded above for catch-up honesty. */
    List<ExperimentEntity> findByCreatedByAndGeneratedAtGreaterThanEqualAndGeneratedAtLessThanAndDeletedFalse(
            UUID createdBy, Instant from, Instant toExclusive);
}
