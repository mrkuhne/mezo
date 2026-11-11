-- Boop B1 (mezo-r36n9.11): distance, peak heart rate and the source bundle of a Health workout.
alter table wearable_workout add column distance_m    integer;
alter table wearable_workout add column max_hr        integer;
alter table wearable_workout add column source_bundle varchar(120);
alter table wearable_workout add column updated_at    timestamptz not null default now();
alter table wearable_workout add constraint ck_wearable_workout_distance_m_nonneg check (distance_m is null or distance_m >= 0);
alter table wearable_workout add constraint ck_wearable_workout_max_hr_nonneg     check (max_hr is null or max_hr >= 0);
