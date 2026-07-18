package io.mrkuhne.mezo.feature.meal.entity;

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
import java.time.LocalDate;
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
 * A meal aggregate root: a logged eating event ({@code logged_at} instant + denormalized
 * {@code meal_date} day key + {@code slot}) plus an ordered list of polymorphic
 * {@link MealItemEntity} lines. The {@code items} collection is the aggregate boundary —
 * {@code cascade = ALL} + {@code orphanRemoval = true} persist/remove children with the parent,
 * {@code @OrderBy} loads them by {@code line_order}. Mirrors {@code RecipeEntity}.
 *
 * <p>{@code breakdown} is the typed jsonb meal-score envelope ({@link MealBreakdownJson}), always
 * NULL in v1 — the score is deferred to Phase-3 behind the FE pending-sparkle (same precedent as
 * {@code recipe.fit_score}).
 *
 * <p>{@code createdBy}, {@code is_deleted} and {@code created_at} come from {@link OwnedEntity}.
 *
 * <p><b>Soft delete does NOT cascade through {@code @OneToMany}</b>: {@code @SQLDelete} only
 * rewrites this row, so the service must bulk-soft-delete the {@code meal_item} children
 * explicitly on delete (via {@code MealItemRepository.softDeleteByMealId}).
 */
@Getter
@Setter
@Entity
@Table(name = "meal")
@SQLDelete(sql = "update meal set is_deleted = true where id = ?")
@SQLRestriction("is_deleted = false")
public class MealEntity extends OwnedEntity {

    @Id
    @GeneratedValue
    @Column(columnDefinition = "uuid")
    private UUID id;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    @NotNull
    @Column(name = "logged_at", nullable = false)
    private Instant loggedAt;

    @NotNull
    @Column(name = "meal_date", nullable = false)
    private LocalDate mealDate;

    @NotNull
    @Column(nullable = false)
    private String slot; // breakfast|lunch|dinner|snack (DB CHECK)

    @Column
    private String title;

    /** Denormalized scalar of {@code breakdown.value} (ADR 0006 §4) — MealScoringService sets both atomically. */
    @Column
    private BigDecimal score;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MealBreakdownJson breakdown;

    /** Typed jsonb provenance envelope ({@link MealProvenanceJson}) — written by the AI confirm path, NULL for manual/legacy rows. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MealProvenanceJson provenance;

    @OneToMany(mappedBy = "meal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("lineOrder")
    private List<MealItemEntity> items = new ArrayList<>();
}
