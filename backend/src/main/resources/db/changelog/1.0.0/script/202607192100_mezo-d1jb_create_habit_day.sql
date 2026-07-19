-- Habit engine (bd mezo-d1jb): fixed morning/evening routine chains. One row per (user, day, habit).
-- Also relaxes the released level_up_event.source_type CHECK additively: += HABIT (habit XP rides
-- the shared idempotent award tail — ADR 0010, deterministic catalog amounts).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY', 'HABIT'));

create table habit_day (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    habit_date  date        not null,
    habit_key   varchar(40) not null,
    status      varchar(8)  not null default 'pending',
    done_at     timestamptz,
    xp_awarded  integer     not null default 0,
    source      varchar(7),
    constraint pk_habit_day_id primary key (id),
    constraint fk_habit_day_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_habit_day_status check (status in ('pending', 'done', 'missed')),
    constraint ck_habit_day_source check (source is null or source in ('DERIVED', 'MANUAL')),
    constraint ck_habit_day_xp check (xp_awarded >= 0)
);

create index idx_habit_day_user_date on habit_day (created_by, habit_date) where is_deleted = false;
create unique index uq_habit_day_user_date_key on habit_day (created_by, habit_date, habit_key)
    where is_deleted = false;
