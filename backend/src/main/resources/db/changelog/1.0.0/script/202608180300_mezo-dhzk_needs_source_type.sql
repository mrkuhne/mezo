-- Needs day-close XP (mezo-dhzk): relaxes the released level_up_event.source_type CHECK
-- additively: += NEEDS (recovery-skill bonus XP rides the shared idempotent award tail).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY', 'HABIT', 'NEEDS'));
