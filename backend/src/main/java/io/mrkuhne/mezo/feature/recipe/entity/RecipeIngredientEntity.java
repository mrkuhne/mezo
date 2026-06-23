package io.mrkuhne.mezo.feature.recipe.entity;

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
 * One ordered ingredient line of a {@link RecipeEntity} (FK {@code recipe_id},
 * {@code ON DELETE CASCADE}). Lines are ordered within a recipe by {@code lineOrder}.
 *
 * <p>{@code pantryItemId} is a PLAIN UUID column (FK to {@code pantry_item}, {@code ON DELETE
 * RESTRICT}), deliberately NOT a JPA association: the {@code snapshot*} fields capture the live
 * {@code PantryItem}'s name + per-basis macros at write time so a later edit/delete of the source
 * item never silently rewrites this recipe's historical macros.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 */
@Getter
@Setter
@Entity
@Table(name = "recipe_ingredient")
@SQLDelete(sql = "update recipe_ingredient set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RecipeIngredientEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @NotNull
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipe_id", nullable = false)
    private RecipeEntity recipe;

    @NotNull
    @Column(name = "pantry_item_id", nullable = false)
    private UUID pantryItemId;

    @NotNull
    @Column(nullable = false)
    private BigDecimal amount;

    @NotNull
    @Column(nullable = false)
    private String unit;

    @Column
    private String note;

    @NotNull
    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

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
}
