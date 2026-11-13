-- Boop B4 (mezo-r36n9.14, decisions 13/16): a recipe now keeps its method and where it came from.
--  * recipe.steps      — the method as an ordered jsonb array of strings; null = none saved. The workshop and
--                        the import already produced steps, but nothing stored them.
--  * recipe.source_url — the page an imported recipe was read from; null for a recipe written by hand.
-- recipe.image_id already exists (the image-store changeset).
-- NB: no bare question mark anywhere in a changeset (a JDBC placeholder).

alter table recipe add column steps jsonb;
alter table recipe add column source_url text;
