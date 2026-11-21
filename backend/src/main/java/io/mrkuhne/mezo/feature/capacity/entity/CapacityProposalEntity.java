package io.mrkuhne.mezo.feature.capacity.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/** A week-level or day-level rearrangement proposal, with the numbers it was built from (Boop B7 K1, mezo-r36n9.17). */
@Getter
@Setter
@Entity
@Table(name = "capacity_proposal")
@SQLDelete(sql = "update capacity_proposal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CapacityProposalEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @Column
    private LocalDate day;

    /** {@link AdjustmentKind} name of the headline step. */
    @Column(nullable = false, length = 24)
    private String kind;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> bundle;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> facts;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> effects;

    @Column(nullable = false)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> why;

    @Column(name = "generator_version", nullable = false)
    private short generatorVersion;

    /** open | accepted | declined | ignored | undone | expired. */
    @Column(nullable = false, length = 9)
    private String status;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> outcome;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
