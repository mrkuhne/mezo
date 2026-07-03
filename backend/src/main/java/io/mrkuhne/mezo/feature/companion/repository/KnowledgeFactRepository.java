package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeFactRepository extends JpaRepository<KnowledgeFactEntity, UUID> {

    /** The list surface: strongest reinforcement first, then newest. */
    List<KnowledgeFactEntity> findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
            UUID createdBy);

    /** The top-N prompt-injection window (idx_knowledge_fact_created_by_include_reinforcement). */
    List<KnowledgeFactEntity> findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
            UUID createdBy, Pageable pageable);

    Optional<KnowledgeFactEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
