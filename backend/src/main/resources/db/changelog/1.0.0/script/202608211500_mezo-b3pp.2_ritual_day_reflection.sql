-- Phase 5 W1.2 (bd mezo-b3pp.2, spec §5.2): the Napzárás gains an optional prose reflection.
-- The reflection upserts the (created_by, ritual_date) row BEFORE the close, so a ritual_day
-- row no longer implies "the day was closed" — closed_at becomes nullable and every reader
-- moves to `closed_at is not null` (RitualService, HabitEvaluator, MetricSeriesService).
alter table ritual_day add column reflection_text text;
alter table ritual_day alter column closed_at drop not null;
