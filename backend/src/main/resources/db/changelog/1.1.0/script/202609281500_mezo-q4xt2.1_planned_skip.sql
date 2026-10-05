-- Kihagyás S1 (mezo-q4xt2.1, spec 2026-09-28 §8): one user-declared skip of a planned occurrence —
-- a gym day, a recurring sport slot occurrence or a prescribed run — with an optional reason.
-- A read-time overlay (the readiness_choice / workout_day_adjustment idiom): never a template edit,
-- never a workout_session row. Undo is a soft delete. Whether a skip counts as missed (serious
-- reason / weekly free pass) is computed at read time by PlannedSkipPolicy, never stored.
-- SPORT keys on the slot IDENTITY (day_of_week 0=Hét..6=Vas + time), like sport_slot_skip, because
-- sport_schedule_slot rows are re-inserted on every save. RUN keys on the block session key.
create table planned_skip (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid         not null,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now(),
    date            date         not null,
    kind            varchar(8)   not null,
    day_of_week     smallint,
    time            varchar(5),
    session_key     varchar(64),
    reason_category varchar(16)  not null default 'NONE',
    reason_text     varchar(500),
    constraint pk_planned_skip_id primary key (id),
    constraint fk_planned_skip_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_planned_skip_kind check (kind in ('GYM', 'SPORT', 'RUN')),
    constraint ck_planned_skip_reason check (reason_category in
        ('ILLNESS', 'STOMACH', 'INJURY', 'TRAVEL', 'TIRED', 'NO_TIME', 'NO_MOOD', 'OTHER', 'NONE')),
    constraint ck_planned_skip_day_of_week check (day_of_week is null or day_of_week between 0 and 6),
    constraint ck_planned_skip_target check (
        (kind = 'GYM'   and day_of_week is null and time is null and session_key is null) or
        (kind = 'SPORT' and day_of_week is not null and time is not null and session_key is null) or
        (kind = 'RUN'   and day_of_week is null and time is null and session_key is not null))
);
create unique index uq_planned_skip_target
    on planned_skip (created_by, kind, date, coalesce(day_of_week, -1), coalesce(time, ''), coalesce(session_key, ''))
    where is_deleted = false;
create index ix_planned_skip_user_date on planned_skip (created_by, date) where is_deleted = false;
