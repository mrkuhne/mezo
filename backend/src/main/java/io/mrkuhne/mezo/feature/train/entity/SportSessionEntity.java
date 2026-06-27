package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * A logged sport session — volleyball, cross, or TRX. The {@code sport} column is the modality
 * discriminator (DB CHECK {@code volleyball|cross|trx}); it defaults to volleyball when the log
 * omits it. Standalone (no mesocycle FK): owned only via {@code createdBy}. Volleyball-only metrics
 * ({@code setsPlayed}, {@code shoulderStrain}, {@code jumpCount}) and the cross/TRX {@code rounds}
 * effort are nullable per kind; the {@code intensity} and {@code shoulderStrain} 1–10 scores carry a
 * DB CHECK on their range when present.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "sport_session")
@SQLDelete(sql = "update sport_session set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class SportSessionEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private String sport = "volleyball";

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @Column(length = 5)
    private String time;

    @Column(name = "duration_min")
    private Integer durationMin;

    @Column(name = "sets_played")
    private Integer setsPlayed;

    @Column
    private Integer intensity; // null or 1..10 (DB CHECK)

    @Column(precision = 3, scale = 1)
    private BigDecimal rpe;

    @Column(name = "shoulder_strain")
    private Integer shoulderStrain; // null or 1..10 (DB CHECK)

    @Column(name = "jump_count")
    private Integer jumpCount;

    @Column
    private Integer rounds; // cross/TRX effort; null for volleyball

    @Column
    private String notes;
}
