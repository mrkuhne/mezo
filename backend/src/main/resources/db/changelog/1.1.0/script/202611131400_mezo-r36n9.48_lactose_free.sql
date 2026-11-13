-- Boop B4 follow-up (mezo-r36n9.48, owner decision 2026-11-13 "kitöltjük, amit biztosan tudunk"):
-- the lactose-free marking, so an intolerance-level milk rule can stay quiet on the owner's own
-- laktózmentes products while they keep the EU-14 "milk" allergen they genuinely carry (that key is
-- milk protein, not lactose).
--  * pantry_catalog.lactose_free — true only when the product is RECOGNISED as lactose-free.
--    false is "not recognised", never "contains lactose", so false is the safe default.
--  * recipe.lactose_free — DERIVED: true when every milk-bearing ingredient is lactose-free,
--    false when at least one is not, null when no ingredient carries milk at all (nothing to say).
-- The allergen baseline itself is data, not schema: CatalogAllergenDefaults +
-- PantryCatalogAllergenBaselineRunner fill it on boot, so one source of truth serves the backfill
-- and every row added later.
-- NB: no bare question mark anywhere in a changeset (a JDBC placeholder).

alter table pantry_catalog add column lactose_free boolean not null default false;
alter table recipe add column lactose_free boolean;
