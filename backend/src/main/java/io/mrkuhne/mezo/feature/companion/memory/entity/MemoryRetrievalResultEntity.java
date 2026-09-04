package io.mrkuhne.mezo.feature.companion.memory.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** One ranked candidate snapshot belonging to a retrieval run. */
@Getter
@Setter
@Entity
@Table(name = "memory_retrieval_result", uniqueConstraints = {
    @UniqueConstraint(name = "uq_memory_retrieval_result_id_run_owner",
            columnNames = {"id", "run_id", "created_by"}),
    @UniqueConstraint(name = "uq_memory_retrieval_result_run_rank", columnNames = {"run_id", "rank"})
})
@SQLDelete(sql = "update memory_retrieval_result set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryRetrievalResultEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "run_id", nullable = false, columnDefinition = "uuid")
    private UUID runId;

    @NotNull
    @Size(max = 32)
    @Column(name = "candidate_kind", nullable = false, length = 32)
    private String candidateKind;

    @NotNull
    @Column(name = "candidate_ref_id", nullable = false, columnDefinition = "uuid")
    private UUID candidateRefId;

    @Column(name = "memory_item_id", columnDefinition = "uuid")
    private UUID memoryItemId;

    @NotNull
    @Positive
    @Column(nullable = false)
    private Integer rank;

    @Column(nullable = false)
    private boolean selected;

    @NotNull
    @Column(name = "content_snapshot", nullable = false, columnDefinition = "text")
    private String contentSnapshot;

    @Column(name = "occurred_on")
    private LocalDate occurredOn;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "score_breakdown", nullable = false, columnDefinition = "jsonb")
    private ScoreBreakdownEnvelope scoreBreakdown = ScoreBreakdownEnvelope.empty();
}
