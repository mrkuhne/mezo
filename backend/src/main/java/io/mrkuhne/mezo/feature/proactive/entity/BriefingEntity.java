package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One generated morning briefing per user+day (proactive B1.1, spec §3-§4). Regenerable data:
 * uniqueness is a PARTIAL index (uq_briefing_created_by_briefing_date where is_deleted = false),
 * so B1.2's staleness path soft-deletes + reinserts.
 */
@Getter
@Setter
@Entity
@Table(name = "briefing")
@SQLDelete(sql = "update briefing set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class BriefingEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The briefed day (the morning it is FOR — not when it was generated). */
    @NotNull
    @Column(name = "briefing_date", nullable = false)
    private LocalDate briefingDate;

    /** The generated content — eyebrow + paragraphs + model-selected refs. */
    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private BriefingContentEnvelope content;

    /** When the LLM call produced this row — B1.2's staleness anchor. */
    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;

    /** How many times this day's briefing has been regenerated (staleness path, B1.2) —
     *  a fresh row carries its predecessor's count + 1; the GET path caps on it. */
    @Column(name = "regen_count", nullable = false)
    private int regenCount;
}
