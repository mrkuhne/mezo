-- T2 naming fix (mezo-r36n9.80): 202611181600_mezo-r36n9.80_techniques.sql was released (deployed in v3.4.0)
-- with unnamed inline PK / FK / CHECK constraints and an ix_-prefixed index on exercise_set_leg; released
-- changesets are immutable, so the live schema is renamed here to the lint-liquibase convention and the
-- original file is grandfathered.
alter table exercise_set_leg rename constraint exercise_set_leg_pkey to pk_exercise_set_leg;
alter table exercise_set_leg rename constraint exercise_set_leg_exercise_set_id_fkey to fk_exercise_set_leg_exercise_set;
alter table exercise_set_leg rename constraint exercise_set_leg_leg_index_check to ck_exercise_set_leg_leg_index;
alter table exercise_set_leg rename constraint exercise_set_leg_weight_kg_check to ck_exercise_set_leg_weight_kg;
alter table exercise_set_leg rename constraint exercise_set_leg_reps_check to ck_exercise_set_leg_reps;
alter table exercise_set_leg rename constraint exercise_set_leg_rest_sec_check to ck_exercise_set_leg_rest_sec;
alter index ix_exercise_set_leg_set rename to idx_exercise_set_leg_set;
