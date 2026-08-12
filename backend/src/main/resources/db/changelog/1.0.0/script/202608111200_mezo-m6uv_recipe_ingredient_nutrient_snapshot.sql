-- Nutrition-quality facts frozen per recipe line (mezo-m6uv): fiber/sugar/salt/saturated fat in the
-- line's OWN per-basis (snapshot_per), captured from pantry_item at compose time — exactly like
-- snapshot_kcal. NULLABLE on purpose: "the source carried no value" is not "0 g" (an OpenFoodFacts
-- hit often lacks fiber), and a fake 0 would lie to the recipe/meal scorer, which reads these.
--
-- Backfill: today's pantry values, rescaled from the pantry's CURRENT per-basis to the line's frozen
-- snapshot_per. This is an honest approximation, NOT a historical reconstruction — a pantry row that
-- drifted since the recipe was saved contributes its present value (see the ADR). A line whose
-- pantry row is gone or fact-less stays NULL.
ALTER TABLE recipe_ingredient
    ADD COLUMN snapshot_fiber_g numeric,
    ADD COLUMN snapshot_sugar_g numeric,
    ADD COLUMN snapshot_salt_g numeric,
    ADD COLUMN snapshot_saturated_fat_g numeric;

UPDATE recipe_ingredient ri
   SET snapshot_fiber_g =
           round(p.fiber_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_sugar_g =
           round(p.sugar_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_salt_g =
           round(p.salt_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_saturated_fat_g =
           round(p.saturated_fat_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3)
  FROM pantry_item p
 WHERE p.id = ri.pantry_item_id
   AND p.is_deleted = false
   AND p.serving_amount IS NOT NULL
   AND p.serving_amount > 0;
