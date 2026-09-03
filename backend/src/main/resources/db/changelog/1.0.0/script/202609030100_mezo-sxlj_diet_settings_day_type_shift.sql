-- Diet Plan slice 3 (bd mezo-sxlj, spec docs/superpowers/specs/2026-09-02-diet-plan-design.md §6.4).
-- Kcal moved off each rest day onto training days; 0 = uniform. The engine reads it per evaluate.
alter table diet_settings
    add column day_type_shift_kcal integer not null default 0;
