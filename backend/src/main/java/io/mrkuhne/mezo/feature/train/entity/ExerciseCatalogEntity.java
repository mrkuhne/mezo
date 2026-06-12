package io.mrkuhne.mezo.feature.train.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Curated exercise catalog row — MASTER DATA, not user data: no {@code createdBy}, no soft
 * delete. Content lives in {@code content/exercise-catalog.json} and is upserted by
 * {@code slug} at startup ({@link io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader});
 * {@code type} is {@code compound|isolation|plyo}, {@code muscle} a token of the picker
 * taxonomy (both DB CHECKed).
 */
@Getter
@Setter
@Entity
@Table(name = "exercise_catalog")
public class ExerciseCatalogEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @Column(nullable = false, unique = true)
    private String slug;

    @NotNull
    @Column(nullable = false)
    private String name;

    @NotNull
    @Column(nullable = false)
    private String muscle;

    @NotNull
    @Column(nullable = false)
    private String type;

    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal stim;

    @NotNull
    @Column(nullable = false, precision = 3, scale = 2)
    private BigDecimal fatigue;
}
