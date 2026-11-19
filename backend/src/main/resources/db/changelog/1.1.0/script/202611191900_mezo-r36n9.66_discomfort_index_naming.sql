-- Reasoned swap naming fix (mezo-r36n9.66): 202611171020_mezo-r36n9.66_exercise_discomfort.sql was released
-- (deployed, v3.15.0) with an ix_-prefixed index; released changesets are immutable, so the live schema is
-- renamed here to the idx_ convention (lint-liquibase), and the original file is grandfathered.
alter index ix_exercise_discomfort_user_day rename to idx_exercise_discomfort_user_day;
