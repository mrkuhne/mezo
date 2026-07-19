package io.mrkuhne.mezo.feature.recipe.entity;

import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.techcore.persistence.OwnedEntity;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

/**
 * A recipe aggregate root: header fields + an ordered list of {@link RecipeIngredientEntity}
 * lines (the {@code lines} collection is the aggregate boundary — {@code cascade = ALL} +
 * {@code orphanRemoval = true} persist/remove children with the parent, {@code @OrderBy} loads
 * them by {@code line_order}). This is the first true {@code @OneToMany} aggregate in the codebase.
 *
 * <p>{@code tags}/{@code fitsFor} are jsonb string arrays (mirrors the {@code micros} jsonb on
 * {@code PantryItemEntity}). {@code novaDominant} is derived + persisted at write time;
 * {@code fitScore}/{@code fitsFor} stay null until Phase-3 mezo-fit scoring exists.
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 *
 * <p><b>Soft delete does NOT cascade through {@code @OneToMany}</b>: {@code @SQLDelete} only
 * rewrites this row, so the service must bulk-soft-delete the {@code recipe_ingredient} children
 * explicitly on delete.
 */
@Getter
@Setter
@Entity
@Table(name = "recipe")
@SQLDelete(sql = "update recipe set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class RecipeEntity extends OwnedEntity {

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

    @Column
    private String slot;

    @NotNull
    @Column(nullable = false)
    private String category; // breakfast|lunch|dinner|snack (DB CHECK)

    @NotNull
    @Column(nullable = false)
    private Integer servings = 1;

    @Column(name = "prep_mins")
    private Integer prepMins;

    @Column(name = "cook_mins")
    private Integer cookMins;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> tags;

    @Column(nullable = false)
    private boolean starred = false;

    @Column(name = "nova_dominant")
    private Short novaDominant;

    @Column(name = "fit_score")
    private BigDecimal fitScore;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fits_for", columnDefinition = "jsonb")
    private List<String> fitsFor;

    /** Template breakdown cache (mezo-bw3y): 3-dim deterministic envelope + AI prose; null = not generated. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MealBreakdownJson breakdown;

    @OneToMany(mappedBy = "recipe", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineOrder")
    private List<RecipeIngredientEntity> lines = new ArrayList<>();
}
