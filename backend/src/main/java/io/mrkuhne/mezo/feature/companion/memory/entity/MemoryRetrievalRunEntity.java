package io.mrkuhne.mezo.feature.companion.memory.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** One auditable execution of the shared memory retrieval pipeline. */
@Getter
@Setter
@Entity
@Table(name = "memory_retrieval_run", uniqueConstraints = {
    @UniqueConstraint(name = "uq_memory_retrieval_run_id_owner", columnNames = {"id", "created_by"}),
    @UniqueConstraint(name = "uq_memory_retrieval_run_trace_id", columnNames = "trace_id")
})
@SQLDelete(sql = "update memory_retrieval_run set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryRetrievalRunEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 32)
    @Pattern(regexp = "CHAT_AMBIENT|MORNING_BRIEFING|WEEKLY_MEMOIR|PREDICTION_EVIDENCE")
    @Column(name = "consumer_policy", nullable = false, length = 32)
    private String consumerPolicy;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "NONE|RAW|REWRITE")
    @Column(name = "query_mode", nullable = false, length = 16)
    private String queryMode;

    @NotNull
    @Column(name = "raw_query", nullable = false, columnDefinition = "text")
    private String rawQuery;

    @Column(name = "rewritten_query", columnDefinition = "text")
    private String rewrittenQuery;

    @NotNull
    @Size(max = 80)
    @Column(name = "embedding_version", nullable = false, length = 80)
    private String embeddingVersion;

    @Size(max = 80)
    @Column(name = "shadow_embedding_version", length = 80)
    private String shadowEmbeddingVersion;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "OLD|SHADOW|NEW")
    @Column(name = "serving_mode", nullable = false, length = 16)
    private String servingMode;

    @NotNull
    @PositiveOrZero
    @Column(name = "duration_ms", nullable = false)
    private Long durationMs;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "retriever_trace", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> retrieverTrace = new LinkedHashMap<>();

    @Size(max = 100)
    @Column(name = "error_code", length = 100)
    private String errorCode;

    @NotNull
    @Column(name = "trace_id", nullable = false, columnDefinition = "uuid")
    private UUID traceId;
}
