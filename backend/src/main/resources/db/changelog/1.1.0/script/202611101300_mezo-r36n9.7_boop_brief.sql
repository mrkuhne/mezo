-- Boop S3 (mezo-r36n9.7): the morning brief (one generated payload per owner and local day) and the
-- moved time of today's training session (a per-day override, never a change of the plan itself).
create table boop_brief (
    id           uuid         not null default gen_random_uuid(),
    created_by   uuid         not null,
    is_deleted   boolean      not null default false,
    created_at   timestamptz  not null default now(),
    date         date         not null,
    payload      jsonb        not null,
    input_hash   varchar(64)  not null,
    regen_count  integer      not null default 0,
    generated_at timestamptz  not null,
    constraint pk_boop_brief_id primary key (id),
    constraint ck_boop_brief_regen_count check (regen_count >= 0),
    constraint fk_boop_brief_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_boop_brief_user_date on boop_brief (created_by, date) where is_deleted = false;

create table workout_time_override (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    date        date        not null,
    time        time        not null,
    constraint pk_workout_time_override_id primary key (id),
    constraint fk_workout_time_override_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create unique index uq_workout_time_override_user_date on workout_time_override (created_by, date) where is_deleted = false;
