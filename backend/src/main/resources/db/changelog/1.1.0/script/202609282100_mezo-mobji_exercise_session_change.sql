-- Mid-workout exercise swap / add (bd mezo-mobji). Every change creates an INSTANCE-scoped
-- exercise row (workout_session_id = the running instance). replaces_exercise_id = the row it
-- replaces in that instance; saved_to_plan = the change was also written to the mesocycle.
-- A "Mezociklusra is" change also inserts ONE template row tagged added_in_workout_id = the
-- instance, so that instance keeps showing its own row and the template row takes effect from
-- the next session. Additive; existing rows keep null/false.
alter table exercise add column replaces_exercise_id uuid;
alter table exercise add constraint fk_exercise_replaces_exercise_id_exercise_id
    foreign key (replaces_exercise_id) references exercise(id) on delete set null;
create index idx_exercise_replaces_exercise_id on exercise (replaces_exercise_id);
alter table exercise add column added_in_workout_id uuid;
alter table exercise add constraint fk_exercise_added_in_workout_id_workout_session_id
    foreign key (added_in_workout_id) references workout_session(id) on delete set null;
create index idx_exercise_added_in_workout_id on exercise (added_in_workout_id);
alter table exercise add column saved_to_plan boolean not null default false;
