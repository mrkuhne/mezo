-- mezo-jb84: a third, LOWER protein tier joins the band. Until now the tier moved only the
-- body-weight coefficient while the lean-mass path stayed pinned at its high end, so for anyone
-- whose lean-mass path wins the switch changed nothing — the target sat at the cap either way.
-- The engine now moves both coefficients, and `low` is the band's floor.
--
-- Same CHECK-swap idiom as 202609091500_mezo-76f6_feedback_meal_coach_recipe_breakdown_kind.sql:
-- no data migration, because a WIDENED check never touches existing rows — it only widens what a
-- future write may claim. Every stored 'moderate'/'high' row stays valid.
alter table diet_settings drop constraint ck_diet_settings_protein_tier;
alter table diet_settings add constraint ck_diet_settings_protein_tier
    check (protein_tier in ('low', 'moderate', 'high'));
