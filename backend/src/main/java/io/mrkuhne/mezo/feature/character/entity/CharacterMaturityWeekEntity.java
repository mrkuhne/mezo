package io.mrkuhne.mezo.feature.character.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * Egy dimenzió érettsége egy ISO-héten (csapatfal érettség-görbe, mezo-a9bo7.11) — periodikus
 * pillanatkép, szemcse = (tulajdonos, dimenzió, hét). Az éjszakai job frissíti a hét során; a
 * vasárnap esti futás teszi véglegessé. Nincs kitöltő sor és nincs visszamenőleges pont (ADR 0049).
 */
@Getter
@Setter
@Entity
@Table(name = "character_maturity_week")
@SQLDelete(sql = "update character_maturity_week set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class CharacterMaturityWeekEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(name = "dimension_id", nullable = false, columnDefinition = "uuid")
    private UUID dimensionId;

    /** ISO Monday (Europe/Budapest) — mirrors {@code ck_character_maturity_week_monday}. */
    @NotNull
    @Column(name = "week_start", nullable = false)
    private LocalDate weekStart;

    @NotNull @Min(0) @Max(100)
    @Column(nullable = false)
    private Short maturity;

    @NotNull @Min(0)
    @Column(name = "claim_count", nullable = false)
    private Short claimCount;

    /** Mean ACTIVE confidence; {@code null} when the dimension held no active claim that week. */
    @Column(name = "mean_confidence", precision = 4, scale = 3)
    private BigDecimal meanConfidence;

    @NotNull
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();
}
