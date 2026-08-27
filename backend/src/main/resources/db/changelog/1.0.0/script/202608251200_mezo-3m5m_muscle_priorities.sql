-- mezo-3m5m: sparse per-coarse-muscle priority tier map ({"back":"emphasize","glute":"maintain"}).
-- Absent key = grow. No backfill: NULL = all grow, so live behaviour does not jump on deploy (spec GD3).
alter table mesocycle     add column muscle_priorities jsonb;
alter table meso_template add column muscle_priorities jsonb;
