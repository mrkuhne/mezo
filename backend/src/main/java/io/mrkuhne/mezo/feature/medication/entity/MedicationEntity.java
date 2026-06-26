package io.mrkuhne.mezo.feature.medication.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * The medication catalog row (Fuel "Gyógyszer"): a master entry naming the medication, its active
 * ingredient, route, cadence and default dose, plus a typed jsonb {@link MedicationCycleJson}
 * envelope describing the on/off schedule. Actual intakes are logged separately as
 * {@link MedicationDoseEntity} rows.
 *
 * <p>{@code cycle} is the typed jsonb config envelope mapped via {@code @JdbcTypeCode(SqlTypes.JSON)}
 * — same pattern as {@code meal.breakdown} / {@code ProvenanceEnvelope}.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "medication")
@SQLDelete(sql = "update medication set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MedicationEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(nullable = false)
    private String name;

    @Column(name = "active_ingredient")
    private String activeIngredient;

    @Column
    private String route;

    @Column
    private String cadence;

    @Column(name = "default_dose")
    private BigDecimal defaultDose;

    @Column(name = "dose_unit")
    private String doseUnit;

    @NotNull
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private MedicationCycleJson cycle;

    @NotNull
    @Column(name = "is_active", nullable = false)
    private boolean active = true;
}
