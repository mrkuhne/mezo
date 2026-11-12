-- Boop B3 (mezo-r36n9.13): the biomarker snapshot frozen at a check-in's capture moment — 1:1 with
-- check_in (one live row per check-in). Computed on the phone from HealthKit (computed_by = phone) or,
-- for a check-in that arrives without one (the web), filled by the server from health_sample /
-- daily_metric / sleep_log (computed_by = server). Every reading is nullable with its sample time.
create table check_in_snapshot (
    id                 uuid             not null default gen_random_uuid(),
    created_by         uuid             not null,
    is_deleted         boolean          not null default false,
    created_at         timestamptz      not null default now(),
    updated_at         timestamptz      not null default now(),
    check_in_id        uuid             not null,
    hr_bpm             integer,
    hr_at              timestamptz,
    hrv_ms             double precision,
    hrv_at             timestamptz,
    hrv_usual_ms       double precision,
    steps              integer,
    steps_is_day_total boolean,
    sleep_minutes      integer,
    source             varchar(120),
    computed_by        varchar(8)       not null,
    constraint pk_check_in_snapshot_id primary key (id),
    constraint fk_check_in_snapshot_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_check_in_snapshot_check_in_id_check_in_id foreign key (check_in_id) references check_in (id) on delete cascade,
    constraint ck_check_in_snapshot_computed_by check (computed_by in ('phone', 'server'))
);
create unique index uq_check_in_snapshot_check_in_live on check_in_snapshot (check_in_id) where is_deleted = false;
