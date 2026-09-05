package io.mrkuhne.mezo.feature.companion.flags.entity;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * One CHANGE in what a rule concluded (spec 2026-09-05 §4.3). Unlike {@code companion_flag_log},
 * which records only raises, this records every rule's verdict — but only when it differs from
 * that rule's previous row, so an unchanged hourly sweep writes nothing.
 */
@Getter
@Setter
@Entity
@Table(name = "companion_flag_trace")
@SQLDelete(sql = "update companion_flag_trace set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CompanionFlagTraceEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** Mirrors ck_companion_flag_trace_flag_key — see {@code FlagKey}. Widened by Round 2 S1
     *  (bd mezo-d58h.7.1) for {@code protocol_lapse}. */
    @NotNull
    @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy"
        + "|logging_gap|missed_workouts|acute_bad_day|load_fuel_mismatch|rapid_weight_loss"
        + "|joint_overuse|ignored_nudge|late_eating|protocol_lapse")
    @Column(name = "flag_key", nullable = false, length = 24)
    private String flagKey;

    /** Mirrors ck_companion_flag_trace_outcome — see {@code FlagOutcome}, lower-cased. */
    @NotNull
    @Pattern(regexp = "raised|clear|unavailable")
    @Column(nullable = false, length = 12)
    private String outcome;

    /** {@code UnavailableReason} lower-cased, null unless the outcome is unavailable. */
    @Column(name = "reason_code", length = 32)
    private String reasonCode;

    /** {@code TraceDisposition} lower-cased, null unless the rule raised. */
    @Column(length = 24)
    private String disposition;

    /** The CLEAR verdict's observed value and threshold; null for the other outcomes. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private FlagVerdict.ClearEvidence evidence;

    /** When the evaluation happened — the ordering key for both observer reads. */
    @NotNull
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
}
