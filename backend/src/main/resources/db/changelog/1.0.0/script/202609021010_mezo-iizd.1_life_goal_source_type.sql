-- Life-goal pillar-hit XP (mezo-iizd.1): relaxes level_up_event.source_type additively: += LIFE_GOAL.
-- Slice 2 awards through the shared idempotent tail; the CHECK is widened now so the schema is final.
alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY', 'HABIT', 'NEEDS', 'LIFE_GOAL'));
