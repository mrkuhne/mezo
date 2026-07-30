-- Per-ingredient amount overrides captured when a recipe is logged (mezo-ormb): only the lines the
-- user actually changed, self-describing (name/unit/original_amount) so the log renders without
-- resolving the live recipe, which may since have dropped that line. NULL = the recipe as written,
-- so every existing row keeps its exact current meaning — no backfill.
ALTER TABLE meal_item
    ADD COLUMN recipe_overrides jsonb;
