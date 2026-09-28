package io.mrkuhne.mezo.feature.train.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * The user's answer to one day's training-readiness card (Check-in 2.0, mezo-ck2, spec
 * 2026-09-27 §3.3). One live row per (user, date); undo ("Visszaállítom a tervet") is a soft
 * delete. {@link Choice#LIGHTEN} is read at request time by {@code WorkoutService.getToday} (via
 * {@code ReadinessLightening}) — like {@link WorkoutDayAdjustmentEntity}, a read-time overlay that
 * never touches the template.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "readiness_choice")
@SQLDelete(sql = "update readiness_choice set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class ReadinessChoiceEntity extends OwnedEntity {

    /** The stored values (CHECK {@code ck_readiness_choice_choice}). */
    public enum Choice { LIGHTEN, KEEP }

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false)
    private LocalDate date;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Choice choice;
}
