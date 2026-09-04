-- mezo-r4n7 (diet-plan slice 5): accepted adaptive corrections accumulate here; the projection
-- adds it to the trajectory's daily energy balance. NULL/0 = no correction accepted yet.
alter table goal add column balance_adjustment_kcal integer;
