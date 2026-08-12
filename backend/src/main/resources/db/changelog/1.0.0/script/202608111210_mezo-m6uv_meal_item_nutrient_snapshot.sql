-- Nutrition-quality facts frozen per logged meal item (mezo-m6uv), the meal_item sibling of the
-- recipe_ingredient snapshot. Recipe arm: the whole-recipe rollup ÷ servings, in the item's "adag"
-- basis (snapshot_per = 1). Pantry arm: the live pantry item's per-basis value. NULLABLE for the
-- same reason as on recipe_ingredient: "no data" is not "0 g", and the scorer reads these.
--
-- Backfill (honest approximation, see the ADR): the pantry arm takes today's pantry values rescaled
-- to the item's frozen snapshot_per; the recipe arm sums the recipe's (already backfilled) line
-- snapshots ÷ servings, IGNORING any per-line override envelope the item may carry — a historically
-- exact replay is not reconstructable from what we stored. Rows whose source is gone stay NULL.
ALTER TABLE meal_item
    ADD COLUMN snapshot_fiber_g numeric,
    ADD COLUMN snapshot_sugar_g numeric,
    ADD COLUMN snapshot_salt_g numeric,
    ADD COLUMN snapshot_saturated_fat_g numeric;

-- pantry arm
UPDATE meal_item mi
   SET snapshot_fiber_g =
           round(p.fiber_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_sugar_g =
           round(p.sugar_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_salt_g =
           round(p.salt_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_saturated_fat_g =
           round(p.saturated_fat_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3)
  FROM pantry_item p
 WHERE mi.source = 'pantry'
   AND p.id = mi.pantry_item_id
   AND p.is_deleted = false
   AND p.serving_amount IS NOT NULL
   AND p.serving_amount > 0;

-- recipe arm: Σ over the recipe's frozen lines ÷ servings (SUM ignores NULLs, so a fact-less line
-- simply does not contribute and an all-null recipe yields NULL — the same rule the Java rollup uses)
UPDATE meal_item mi
   SET snapshot_fiber_g = round(agg.fiber / greatest(coalesce(r.servings, 1), 1), 3),
       snapshot_sugar_g = round(agg.sugar / greatest(coalesce(r.servings, 1), 1), 3),
       snapshot_salt_g = round(agg.salt / greatest(coalesce(r.servings, 1), 1), 3),
       snapshot_saturated_fat_g = round(agg.sat_fat / greatest(coalesce(r.servings, 1), 1), 3)
  FROM recipe r,
       (SELECT ri.recipe_id,
               sum(ri.snapshot_fiber_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS fiber,
               sum(ri.snapshot_sugar_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS sugar,
               sum(ri.snapshot_salt_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS salt,
               sum(ri.snapshot_saturated_fat_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS sat_fat
          FROM recipe_ingredient ri
         WHERE ri.is_deleted = false
         GROUP BY ri.recipe_id) agg
 WHERE mi.source = 'recipe'
   AND mi.recipe_id = agg.recipe_id
   AND r.id = agg.recipe_id;
