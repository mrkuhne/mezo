package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LearnedFactRepository extends JpaRepository<LearnedFactEntity, UUID> {

    /** The pending inbox: undecided candidates, newest first (idx_learned_fact_created_by_user_decision). */
    List<LearnedFactEntity> findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(
            UUID createdBy);

    Optional<LearnedFactEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
