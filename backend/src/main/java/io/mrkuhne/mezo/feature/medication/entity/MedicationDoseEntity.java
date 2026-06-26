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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;

/**
 * An append-only ledger row recording one actual intake of a {@link MedicationEntity}
 * (FK {@code medication_id}, {@code ON DELETE RESTRICT} so a logged dose pins its medication in
 * place). {@code administeredAt} is the precise instant; {@code administeredDate} denormalizes the
 * day key for per-day lookups.
 *
 * <p>{@code medicationId} is a PLAIN UUID column (deliberately NOT a JPA association), mirroring the
 * {@code meal_item} plain-UUID-FK pattern.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "medication_dose")
@SQLDelete(sql = "update medication_dose set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MedicationDoseEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(name = "medication_id", nullable = false)
    private UUID medicationId;

    @NotNull
    @Column(name = "administered_at", nullable = false)
    private Instant administeredAt;

    @NotNull
    @Column(name = "administered_date", nullable = false)
    private LocalDate administeredDate;

    @NotNull
    @Column(nullable = false)
    private BigDecimal dose;

    @Column
    private String note;
}
