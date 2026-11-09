-- Boop S2 (mezo-r36n9.2): Apple Health day totals, wearable workouts and the device-calendar
-- snapshot. All owned tables; day totals upsert by (owner, date), workouts by (owner, external id),
-- calendar rows are replaced per (owner, date) by a hard delete + insert (a snapshot, not history).
create table daily_metric (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    date        date        not null,
    steps       integer     check (steps is null or steps >= 0),
    resting_hr  integer     check (resting_hr is null or resting_hr >= 0),
    avg_hr      integer     check (avg_hr is null or avg_hr >= 0),
    min_hr      integer     check (min_hr is null or min_hr >= 0),
    max_hr      integer     check (max_hr is null or max_hr >= 0),
    active_kcal integer     check (active_kcal is null or active_kcal >= 0),
    constraint pk_daily_metric_id primary key (id),
    constraint fk_daily_metric_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_daily_metric_owner_date unique (created_by, date)
);

create table wearable_workout (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    external_id   varchar(64) not null,
    date          date        not null,
    activity_type varchar(40) not null,
    start_at      timestamptz not null,
    end_at        timestamptz not null,
    kcal          integer     check (kcal is null or kcal >= 0),
    avg_hr        integer     check (avg_hr is null or avg_hr >= 0),
    source_name   varchar(80),
    constraint pk_wearable_workout_id primary key (id),
    constraint fk_wearable_workout_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_wearable_workout_owner_external unique (created_by, external_id)
);
create index idx_wearable_workout_owner_date on wearable_workout (created_by, date);

create table calendar_event (
    id            uuid         not null default gen_random_uuid(),
    created_by    uuid         not null,
    is_deleted    boolean      not null default false,
    created_at    timestamptz  not null default now(),
    date          date         not null,
    title         varchar(200) not null,
    start_at      timestamptz  not null,
    end_at        timestamptz  not null,
    all_day       boolean      not null,
    calendar_name varchar(80),
    constraint pk_calendar_event_id primary key (id),
    constraint fk_calendar_event_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create index idx_calendar_event_owner_date on calendar_event (created_by, date);
