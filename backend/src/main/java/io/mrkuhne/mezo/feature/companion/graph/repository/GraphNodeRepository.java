package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GraphNodeRepository extends JpaRepository<GraphNodeEntity, UUID> {

    Optional<GraphNodeEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    Optional<GraphNodeEntity> findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
        UUID createdBy, String sourceKind, UUID sourceId);

    List<GraphNodeEntity> findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String status);

    /** W2.2 edge structurer's candidate list — every OTHER active node the new node could link to,
     *  newest first, capped by the caller's {@link Limit} (the prompt idiom: {@code
     *  PantryImportRepository}/{@code KnowledgeFactRepository} bound the same way) so prompt size
     *  stays flat as the graph grows instead of scaling with the user's total active node count. */
    List<GraphNodeEntity> findByCreatedByAndStatusAndIdNotAndDeletedFalseOrderByCreatedAtDesc(
        UUID createdBy, String status, UUID excludedId, Limit limit);

    /**
     * W2.3's per-day idempotence probe: has the extractor ALREADY processed this day for this
     * user? Deliberately native and deliberately blind to {@code is_deleted} — a candidate the
     * user rejected is soft-deleted, and a JPA finder (which {@code @SQLRestriction} filters)
     * would report the night as unprocessed and resurrect the same rejected guess every night.
     *
     * <p>The literal {@code 'extractor'} below MUST stay equal to {@code
     * LifeEventExtractionService.SOURCE_EXTRACTOR} — a native query can't reference the Java
     * constant, so a rename on one side silently breaks the gate on the other;
     * {@code LifeEventExtractionServiceIT} pins the two together.
     */
    @Query(value = """
        select count(*) from knowledge_node
        where created_by = :createdBy and source_kind = 'extractor' and occurred_on = :occurredOn
        """, nativeQuery = true)
    long countExtractorNodesOnDay(@Param("createdBy") UUID createdBy, @Param("occurredOn") LocalDate occurredOn);
}
