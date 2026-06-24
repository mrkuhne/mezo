package io.mrkuhne.mezo.feature.meal.entity;

import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * One ordered, polymorphic line of a {@link MealEntity} (FK {@code meal_id},
 * {@code ON DELETE CASCADE}). Lines are ordered within a meal by {@code lineOrder}.
 *
 * <p>The line is polymorphic on {@code source} ({@code 'recipe'} | {@code 'pantry'}): exactly one
 * of {@code recipeId} / {@code pantryItemId} is set (DB CHECK {@code ck_meal_item_arm}). BOTH are
 * PLAIN UUID columns (FK to {@code recipe}/{@code pantry_item}, {@code ON DELETE RESTRICT}),
 * deliberately NOT JPA associations: the {@code snapshot*} fields capture the live source's name +
 * per-basis macros at write time so a later edit/delete of the source never silently rewrites this
 * meal's historical macros (identical rationale to {@code recipe_ingredient.pantryItemId}).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "meal_item")
@SQLDelete(sql = "update meal_item set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MealItemEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "meal_id", nullable = false)
    private MealEntity meal;

    @NotNull
    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

    @NotNull
    @Column(nullable = false)
    private String source; // recipe | pantry (DB CHECK ck_meal_item_source)

    @Column(name = "recipe_id")
    private UUID recipeId;

    @Column(name = "pantry_item_id")
    private UUID pantryItemId;

    @NotNull
    @Column(nullable = false)
    private BigDecimal amount;

    @NotNull
    @Column(nullable = false)
    private String unit;

    @NotNull
    @Column(name = "snapshot_name", nullable = false)
    private String snapshotName;

    @NotNull
    @Column(name = "snapshot_per", nullable = false)
    private BigDecimal snapshotPer;

    @NotNull
    @Column(name = "snapshot_basis_unit", nullable = false)
    private String snapshotBasisUnit;

    @NotNull
    @Column(name = "snapshot_kcal", nullable = false)
    private BigDecimal snapshotKcal;

    @NotNull
    @Column(name = "snapshot_protein_g", nullable = false)
    private BigDecimal snapshotProteinG;

    @NotNull
    @Column(name = "snapshot_carbs_g", nullable = false)
    private BigDecimal snapshotCarbsG;

    @NotNull
    @Column(name = "snapshot_fat_g", nullable = false)
    private BigDecimal snapshotFatG;

    @Column(name = "snapshot_nova")
    private Short snapshotNova;
}
