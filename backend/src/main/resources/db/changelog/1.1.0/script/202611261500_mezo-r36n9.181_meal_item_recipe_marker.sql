-- Boop Étel (mezo-r36n9.181): a recipe can be logged ingredient by ingredient. Each ingredient is an ordinary
-- pantry line that ALSO carries the recipe it came from (recipe_id as a "part of recipe" marker) plus the recipe's
-- name frozen at log time, so the meal still reads "from <recipe>" after the recipe is renamed or deleted.
alter table meal_item add column recipe_snapshot_name text;

alter table meal_item drop constraint ck_meal_item_arm;
alter table meal_item add constraint ck_meal_item_arm
    check (
        (source = 'recipe' and recipe_id is not null and pantry_item_id is null)
        or (source = 'pantry' and pantry_item_id is not null)
        or (source = 'estimate' and recipe_id is null and pantry_item_id is null)
    );
