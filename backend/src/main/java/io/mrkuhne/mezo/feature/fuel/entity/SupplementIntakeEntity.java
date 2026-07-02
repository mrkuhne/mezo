package io.mrkuhne.mezo.feature.fuel.entity;

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
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * An append-only ledger row recording one actual supplement intake (Fuel), mirroring
 * {@code medication_dose}. {@code pantryItemId} (FK -> pantry_item, RESTRICT) is a PLAIN UUID column
 * (deliberately NOT a JPA association). {@code takenAt} is the precise instant; {@code takenDate}
 * denormalizes the day key for per-day lookups.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 * There is no {@code updated_at} column, hence no {@code @UpdateTimestamp} field.
 */
@Getter
@Setter
@Entity
@Table(name = "supplement_intake")
@SQLDelete(sql = "update supplement_intake set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SupplementIntakeEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "pantry_item_id", nullable = false)
    private UUID pantryItemId;

    @NotNull
    @Column(name = "taken_at", nullable = false)
    private Instant takenAt;

    @NotNull
    @Column(name = "taken_date", nullable = false)
    private LocalDate takenDate;

    @Column(name = "slot_key")
    private String slotKey;

    @Column
    private String dose;

    @Column
    private String note;
}
