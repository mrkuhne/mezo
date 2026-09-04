package io.mrkuhne.mezo.feature.companion.memory.entity;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Array;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** One independently deployable embedding generation for a canonical memory item. */
@Getter
@Setter
@Entity
@Table(name = "memory_vector", uniqueConstraints =
    @UniqueConstraint(name = "uq_memory_vector_item_version", columnNames = {"memory_item_id", "embedding_version"}))
@SQLDelete(sql = "update memory_vector set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryVectorEntity extends OwnedEntity {

    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_READY = "ready";
    public static final String STATUS_FAILED = "failed";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "memory_item_id", nullable = false, columnDefinition = "uuid")
    private UUID memoryItemId;

    @NotNull
    @Size(max = 80)
    @Column(name = "embedding_version", nullable = false, length = 80)
    private String embeddingVersion;

    @NotNull
    @Size(max = 32)
    @Column(nullable = false, length = 32)
    private String provider;

    @NotNull
    @Size(max = 120)
    @Column(nullable = false, length = 120)
    private String model;

    @NotNull
    @Min(EmbeddingPort.DIMENSIONS)
    @Max(EmbeddingPort.DIMENSIONS)
    @Column(nullable = false)
    private Short dimensions = (short) EmbeddingPort.DIMENSIONS;

    @JdbcTypeCode(SqlTypes.VECTOR)
    @Array(length = EmbeddingPort.DIMENSIONS)
    @Column
    private float[] embedding;

    @NotNull
    @Size(min = 64, max = 64)
    @Pattern(regexp = "[0-9a-f]{64}")
    @Column(name = "embedded_content_hash", nullable = false, length = 64)
    private String embeddedContentHash;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "pending|ready|failed")
    @Column(nullable = false, length = 16)
    private String status;

    @Size(max = 100)
    @Column(name = "failure_code", length = 100)
    private String failureCode;

    @AssertTrue(message = "ready vectors must contain an embedding with the configured dimensions")
    public boolean isReadyEmbeddingValid() {
        return !STATUS_READY.equals(status)
                || embedding != null && embedding.length == EmbeddingPort.DIMENSIONS;
    }
}
