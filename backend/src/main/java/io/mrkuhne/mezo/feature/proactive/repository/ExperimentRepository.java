package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
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
}
