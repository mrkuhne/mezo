package io.mrkuhne.mezo.feature.companion.flags.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One raised composite state flag (Phase 5 W5.1, bd mezo-b3pp.18, spec §4.5/§9.1). Append-only
 * audit: the evaluator writes a row only when a flag actually RAISES (cooldown-gated), never on a
 * quiet evaluation, and nothing ever updates a row. {@code payload} freezes the evaluator's
 * inputs at raise time.
 */
@Getter
@Setter
@Entity
@Table(name = "companion_flag_log")
@SQLDelete(sql = "update companion_flag_log set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CompanionFlagLogEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_companion_flag_log_flag_key — see {@code FlagKey}. */
    @NotNull
    @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy"
        + "|logging_gap|missed_workouts|acute_bad_day|load_fuel_mismatch|rapid_weight_loss"
        + "|joint_overuse|ignored_nudge|late_eating")
    @Column(name = "flag_key", nullable = false, length = 24)
    private String flagKey;

    /** Mirrors ck_companion_flag_log_source: {@code write} (on-write listener) | {@code sweep} (hourly job). */
    @NotNull
    @Pattern(regexp = "write|sweep")
    @Column(nullable = false, length = 6)
    private String source;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private FlagPayloadEnvelope payload;
}
