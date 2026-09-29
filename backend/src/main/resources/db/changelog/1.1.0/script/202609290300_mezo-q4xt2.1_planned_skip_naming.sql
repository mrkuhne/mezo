-- Kihagyás S1 naming fix (mezo-q4xt2.1): 202609281500_mezo-q4xt2.1_planned_skip.sql was released
-- (deployed) with an ix_-prefixed index; released changesets are immutable, so the live schema is
-- renamed here to the idx_ convention (lint-liquibase), and the original file is grandfathered.
alter index ix_planned_skip_user_date rename to idx_planned_skip_user_date;
