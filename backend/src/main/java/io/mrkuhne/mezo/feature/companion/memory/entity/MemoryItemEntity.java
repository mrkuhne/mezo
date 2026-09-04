package io.mrkuhne.mezo.feature.companion.memory.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/** Versioned canonical retrieval projection; the source-domain row remains authoritative. */
@Getter
@Setter
@Entity
@Table(name = "memory_item", uniqueConstraints = {
    @UniqueConstraint(name = "uq_memory_item_id_created_by", columnNames = {"id", "created_by"}),
    @UniqueConstraint(name = "uq_memory_item_owner_source", columnNames = {"created_by", "source_kind", "source_id"})
})
@SQLDelete(sql = "update memory_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MemoryItemEntity extends OwnedEntity {

    public static final String STATE_ACTIVE = "active";
    public static final String STATE_SUPPRESSED = "suppressed";
    public static final String STATE_SUPERSEDED = "superseded";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Size(max = 32)
    @Column(name = "source_kind", nullable = false, length = 32)
    private String sourceKind;

    @NotNull
    @Column(name = "source_id", nullable = false, columnDefinition = "uuid")
    private UUID sourceId;

    @Column(columnDefinition = "text")
    private String title;

    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @NotNull
    @Column(name = "search_text", nullable = false, columnDefinition = "text")
    private String searchText;

    @NotNull
    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @NotNull
    @Size(min = 64, max = 64)
    @Pattern(regexp = "[0-9a-f]{64}")
    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @NotNull
    @Positive
    @Column(name = "schema_version", nullable = false)
    private Integer schemaVersion;

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> topics = new ArrayList<>();

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> people = new ArrayList<>();

    @NotNull
    @DecimalMin("0.000")
    @DecimalMax("1.000")
    @Column(nullable = false, precision = 4, scale = 3)
    private BigDecimal salience = new BigDecimal("0.500");

    @Column(name = "valid_from")
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "active|suppressed|superseded")
    @Column(nullable = false, length = 16)
    private String state = STATE_ACTIVE;

    @Column(name = "superseded_by", columnDefinition = "uuid")
    private UUID supersededBy;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private MemoryProvenanceEnvelope provenance = MemoryProvenanceEnvelope.empty();

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @AssertTrue(message = "valid_to must not precede valid_from")
    public boolean isValidityRangeValid() {
        return validFrom == null || validTo == null || !validTo.isBefore(validFrom);
    }
}
