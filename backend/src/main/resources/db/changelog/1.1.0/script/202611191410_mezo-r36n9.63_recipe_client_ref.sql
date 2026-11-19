-- Idempotent recipe create (mezo-dguzv, fixed with mezo-r36n9.63): „Mentem, és rögzítem mára" makes a
-- double tap on save likelier, and a retried create used to store the recipe twice. A retried request
-- carries the same client_ref, so it returns the first recipe instead. Unique per owner among live rows
-- only (the meal / water_log / journal_entry shape); rows without a ref — every existing recipe, and any
-- caller that sends none — are outside the partial index, so NULLs never collide.
alter table recipe add column client_ref uuid;
create unique index uq_recipe_created_by_client_ref on recipe (created_by, client_ref)
    where client_ref is not null and is_deleted = false;
