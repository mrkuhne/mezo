package io.mrkuhne.mezo.feature.companion.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * One entry of a pattern's append-only history (S1, spec 2026-08-14 §Backend 1): nightly
 * {@code snapshot}s (confirmed rows included — row stats frozen, history accrues), the user's
 * L2 decisions, V3.3 reinforcements and the first-confirm fact promotion. The FE derives the
 * strength chart from snapshots and the journal's band-crossing lines at render time.
 */
@Getter
@Setter
@Entity
@Table(name = "pattern_event")
@SQLDelete(sql = "update pattern_event set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class PatternEventEntity extends OwnedEntity {

    public static final String KIND_SNAPSHOT = "snapshot";
    public static final String KIND_CONFIRMED = "confirmed";
    public static final String KIND_MONITORING = "monitoring";
    public static final String KIND_REJECTED = "rejected";
    public static final String KIND_REINFORCED = "reinforced";
    public static final String KIND_PROMOTED = "promoted";

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "pattern_id", nullable = false, columnDefinition = "uuid")
    private UUID patternId;

    /** Mirrors ck_pattern_event_kind. */
    @NotNull
    @Size(max = 16)
    @Pattern(regexp = "snapshot|confirmed|monitoring|rejected|reinforced|promoted")
    @Column(nullable = false, length = 16)
    private String kind;

    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt = Instant.now().truncatedTo(ChronoUnit.MICROS);

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private PatternEventPayloadEnvelope payload = PatternEventPayloadEnvelope.empty();
}
