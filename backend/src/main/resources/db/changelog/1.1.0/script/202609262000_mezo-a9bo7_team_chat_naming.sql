-- mezo-a9bo7.21 follow-up: bring the released team chat schema onto the naming convention
-- (fk_ / idx_). 202609261500_mezo-a9bo7_team_chat.sql is immutable once released, so the
-- names are fixed here instead; the original file is grandfathered in scripts/lint-liquibase.mjs.
alter table team_chat_line rename constraint team_chat_line_thread_id_fkey to fk_team_chat_line_thread_id;
alter index ix_team_chat_thread_owner_opened rename to idx_team_chat_thread_owner_opened;
alter index ix_team_chat_line_owner_time rename to idx_team_chat_line_owner_time;
