-- Weekly knowledge candidates — "A hét tanulságai" (bd mezo-d20.7.6, handoff §6.2): the weekly
-- review round now PROPOSES onto the same learned_fact path chat extraction uses. Provenance was
-- a single chat message (derived_from_message_id) — a weekly candidate has no message, so the row
-- gains an explicit source + the review's week_start + the evidence line the design shows.
-- knowledge_fact gets the matching FOURTH source constant, otherwise promotion would keep
-- claiming 'chat' (ck_knowledge_fact_source drop + re-add — the
-- 202608271500_mezo-p2tr_feedback_weekly_review_kind.sql idiom).

alter table learned_fact add column source varchar(16);
update learned_fact set source = 'chat' where source is null;
alter table learned_fact alter column source set not null;
alter table learned_fact add constraint ck_learned_fact_source check (source in ('chat', 'weekly_review'));

alter table learned_fact add column week_start date;
alter table learned_fact add column evidence text;

-- a weekly candidate is worthless without the week it belongs to; a chat one never has it
alter table learned_fact add constraint ck_learned_fact_week_start_source
    check ((source = 'weekly_review') = (week_start is not null));

-- the weekly read path: GET /api/proactive/weekly-review/{start}/lessons (owner + week, decided or not)
create index idx_learned_fact_created_by_week_start on learned_fact (created_by, week_start);

alter table knowledge_fact drop constraint ck_knowledge_fact_source;
alter table knowledge_fact add constraint ck_knowledge_fact_source
    check (source in ('chat', 'pattern', 'manual', 'weekly_review'));
