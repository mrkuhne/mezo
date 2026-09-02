alter table habit_def
    add column framework        varchar(5),
    add column anchor_habit_key varchar(40),
    add column cue              varchar(160),
    add column craving          varchar(200),
    add column reward           varchar(160),
    add column celebration      varchar(120),
    add column identity         varchar(120);

alter table habit_def
    add constraint ck_habit_def_framework
        check (framework is null or framework in ('FOGG', 'CLEAR'));

create index idx_habit_def_user_anchor on habit_def (created_by, anchor_habit_key);
