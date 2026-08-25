package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.feature.train.entity.json.MesoDayJson;
import io.mrkuhne.mezo.feature.train.entity.json.VolumeBaselineJson;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;

/**
 * A reusable mesocycle template (the Meso builder blueprint) — {@link #days} snapshots the full
 * day/exercise plan and {@link #volumePerMuscle} the per-muscle volume baseline, both as typed
 * jsonb (mirrors {@code MesocycleEntity.phaseCurve}/{@code volumeRecompute}). A mesocycle started
 * from a template links back via {@code MesocycleEntity.templateId}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "meso_template")
@SQLDelete(sql = "update meso_template set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MesoTemplateEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String title;

    @Column(name = "short_title")
    private String shortTitle;

    @Column
    private String goal;

    /** Machine key of the wizard's goal choice (hypertrophy/strength/…); null = unknown/legacy (mezo-dq60). */
    @Column(name = "goal_preset")
    private String goalPreset;

    @NotNull
    @Column(nullable = false)
    private Integer weeks;

    @Column
    private String split;

    @Column
    private String style;

    @NotNull
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "phase_curve", nullable = false, columnDefinition = "text[]")
    // List (not String[]) so Hibernate dirty-checks element changes — same rationale as
    // MesocycleEntity.phaseCurve.
    private List<String> phaseCurve;

    @Column
    private String notes;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<MesoDayJson> days;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "volume_per_muscle", columnDefinition = "jsonb")
    private Map<String, VolumeBaselineJson> volumePerMuscle;
}
