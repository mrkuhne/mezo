-- Sleep goal + day-anchor (bd mezo-dbsr, spec docs/superpowers/specs/2026-07-23-sleep-anchor-design.md).
-- Per-user singleton (intention_creed shape): target duration + fixed WAKE|BED anchor; the other end
-- is derived at read time. Also enriches sleep_log additively so tracker/screenshot rows (slice B)
-- can carry real in-bed time + phase minutes; all new columns nullable, manual rows stay sparse.

create table sleep_goal (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    target_minutes      integer     not null,
    anchor              varchar(4)  not null,
    anchor_time         varchar(5)  not null,
    regularity_band_min integer     not null default 15,
    constraint pk_sleep_goal_id primary key (id),
    constraint fk_sleep_goal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_sleep_goal_target_minutes check (target_minutes between 1 and 1440),
    constraint ck_sleep_goal_anchor check (anchor in ('WAKE', 'BED')),
    constraint ck_sleep_goal_band check (regularity_band_min >= 1)
);
create unique index uq_sleep_goal_user on sleep_goal (created_by) where is_deleted = false;

alter table sleep_log add column in_bed_min integer;
alter table sleep_log add column awake_min integer;
alter table sleep_log add column light_min integer;
alter table sleep_log add column rem_min integer;
alter table sleep_log add column deep_min integer;
alter table sleep_log add column source_quality_pct integer;
alter table sleep_log add column source varchar(10) default 'manual';
alter table sleep_log add constraint ck_sleep_log_source_quality_pct
    check (source_quality_pct is null or source_quality_pct between 0 and 100);
alter table sleep_log add constraint ck_sleep_log_source
    check (source is null or source in ('manual', 'screenshot'));
