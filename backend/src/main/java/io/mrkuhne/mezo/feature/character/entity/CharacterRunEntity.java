package io.mrkuhne.mezo.feature.character.entity;

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
 * A run-log row for one Karakter pipeline execution (Karakter S9 Gépterem spec §3,
 * mezo-1gim.14) — the honesty spine: a row exists ONLY for a pipeline run that actually
 * executed, including a quiet {@code NIGHTLY} run with zero signals (recorded as
 * {@code (0, 0, [], [])}), so the Gépterem view can tell "csendes éjszaka" apart from "nincs
 * adat erről az éjszakáról" (no row at all — the pipeline never ran).
 */
@Getter
@Setter
@Entity
@Table(name = "character_run")
@SQLDelete(sql = "update character_run set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterRunEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, length = 10)
    private String kind;

    /** The anchor day: the OBSERVED day for NIGHTLY, {@code week_start} for WEEKLY, the month's
     *  first day for MONTHLY, the run date for BOOTSTRAP. */
    @NotNull
    @Column(nullable = false)
    private LocalDate day;

    @NotNull
    @Column(name = "observation_count", nullable = false)
    private Integer observationCount = 0;

    @NotNull
    @Column(name = "call_count", nullable = false)
    private Integer callCount = 0;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detector_keys", nullable = false, columnDefinition = "jsonb")
    private RunDetectorKeysEnvelope detectorKeys;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "expert_keys", nullable = false, columnDefinition = "jsonb")
    private RunExpertKeysEnvelope expertKeys;

    /** Soft ref to the conference this run produced — null for NIGHTLY. */
    @Column(name = "conference_id", columnDefinition = "uuid")
    private UUID conferenceId;

    @NotNull
    @Column(name = "generated_at", nullable = false)
    private Instant generatedAt;
}
