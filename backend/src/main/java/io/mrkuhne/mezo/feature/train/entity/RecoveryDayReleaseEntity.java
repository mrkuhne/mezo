package io.mrkuhne.mezo.feature.train.entity;

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
 * "Ma mégis edzek": one released date inside a {@link RecoveryPeriodEntity} — gym + sport + run
 * of that day train normally (Kihagyás S2, mezo-q4xt2.2, spec 2026-09-28 §9).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "recovery_day_release")
@SQLDelete(sql = "update recovery_day_release set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RecoveryDayReleaseEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "period_id", nullable = false)
    private UUID periodId;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false)
    private boolean lighten = true;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
