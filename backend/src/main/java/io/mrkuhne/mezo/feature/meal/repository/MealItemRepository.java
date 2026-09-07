package io.mrkuhne.mezo.feature.meal.repository;

import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MealItemRepository extends JpaRepository<MealItemEntity, UUID> {

    /**
     * Bulk soft-delete of a meal's lines. @SQLDelete does NOT cascade through @OneToMany on a
     * parent soft-delete (a soft-delete is an UPDATE, so no Hibernate remove-cascade runs), so the
     * service triggers this explicitly before soft-deleting the parent. Set-based UPDATE -> JPQL
     * @Modifying (no derived form exists). Mirrors RecipeIngredientRepository.softDeleteByRecipeId.
     */
    @Modifying
    @Query("update MealItemEntity mi set mi.deleted = true "
        + "where mi.meal.id = :mealId and mi.deleted = false")
    int softDeleteByMealId(@Param("mealId") UUID mealId);

    /**
     * Recipe-logs cross-feature read: a recipe's logged meal-items, newest meal first. {@code recipe_id}
     * is a plain UUID column (not a JPA association), so a derived finder works; the order traverses the
     * parent meal's logged_at (underscore disambiguates the nested path).
     */
    List<MealItemEntity> findByRecipeIdAndCreatedByAndDeletedFalseOrderByMeal_LoggedAtDesc(
        UUID recipeId, UUID createdBy);

    /** Cooking-quest derived signal (E2): did an own-recipe meal item land on this day? */
    boolean existsByCreatedByAndDeletedFalseAndSourceAndMeal_MealDate(
        UUID createdBy, String source, LocalDate mealDate);

    /**
     * One-time heal of the saturated-fat snapshot on pantry-arm lines (mezo-1f7b). The mezo-m6uv
     * migration froze all four nutrient facts from the pantry row, but the catalog carried
     * {@code saturated_fat_g} on only 2 of 147 rows, so this column landed NULL almost everywhere;
     * the seed now fills it, and these lines can take it — the same "honest approximation" the
     * m6uv backfill already made for the other three (ADR 0026), on a column whose NULL means
     * "we never knew", not "the source said none".
     *
     * <p>Strictly {@code IS NULL}-guarded, so it is idempotent AND cannot rewrite a value a real
     * label (OFF/scrape/photo import) has since supplied. Rescaled to the item's own frozen
     * {@code snapshot_per} and rounded to 3 decimals, exactly like the migration it continues.
     * Native because it is set-based over the pantry_item → pantry_catalog join the split
     * (mezo-qw37.4) introduced; the recipe arm heals through the recipe's own line snapshots.
     */
    @Modifying
    @Query(value = """
        update meal_item mi
           set snapshot_saturated_fat_g =
                   round(c.saturated_fat_g
                         * (mi.snapshot_per / coalesce(nullif(c.serving_amount, 0), 1)), 3)
          from pantry_item p
          join pantry_catalog c on c.id = p.catalog_id
         where mi.source = 'pantry'
           and mi.snapshot_saturated_fat_g is null
           and p.id = mi.pantry_item_id
           and c.saturated_fat_g is not null
        """, nativeQuery = true)
    int backfillPantrySaturatedFat();

    /**
     * The meals a {@link #backfillPantrySaturatedFat} run is ABOUT to change — collected BEFORE the
     * update, because afterwards the "was null" evidence is gone (mezo-mxmh).
     *
     * <p>Needed because healing a snapshot does not, by itself, heal the SCORE: the stored envelope
     * was computed from the old null and only {@code MealRescoreRunner} can recompute it, and that
     * runner's work list is "envelopes stamped below {@code FORMULA_VERSION}". On the boot that
     * first filled the catalog, the stamp happened to be current, so 37 snapshots healed and not one
     * score moved — the fix reached the data and stopped there.
     */
    @Query(value = """
        select distinct mi.meal_id from meal_item mi
          join pantry_item p on p.id = mi.pantry_item_id
          join pantry_catalog c on c.id = p.catalog_id
         where mi.source = 'pantry'
           and mi.snapshot_saturated_fat_g is null
           and c.saturated_fat_g is not null
        """, nativeQuery = true)
    List<UUID> mealIdsAwaitingSaturatedFatBackfill();
}
