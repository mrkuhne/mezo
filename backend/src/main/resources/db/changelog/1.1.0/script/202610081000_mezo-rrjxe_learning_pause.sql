-- "Most ne tanulj" (mezo-rrjxe, spec 2026-10-07): one row per pause interval. An interval is in
-- effect from started_at until coalesce(ended_at, planned_end_at, infinity) — expiry is COMPUTED
-- from planned_end_at, the sweep only stamps ended_at afterwards. Intervals are never deleted:
-- every look-back window excludes them forever (owner decision D1, "végleg kimarad").
create table learning_pause (
    id               uuid         not null default gen_random_uuid(),
    created_by       uuid         not null,
    is_deleted       boolean      not null default false,
    created_at       timestamptz  not null default now(),
    started_at       timestamptz  not null,
    planned_end_at   timestamptz,
    ended_at         timestamptz,
    duration_choice  varchar(20)  not null,
    end_reason       varchar(8),
    reminded_at      timestamptz,
    constraint pk_learning_pause_id primary key (id),
    constraint fk_learning_pause_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_learning_pause_duration_choice
        check (duration_choice in ('tonight', 'tomorrow_morning', 'open')),
    constraint ck_learning_pause_end_reason check (end_reason is null or end_reason in ('user', 'expired')),
    constraint ck_learning_pause_planned_end check (planned_end_at is null or planned_end_at > started_at),
    constraint ck_learning_pause_ended check (ended_at is null or ended_at >= started_at)
);
create unique index uq_learning_pause_one_open on learning_pause (created_by)
    where is_deleted = false and ended_at is null;
create index idx_learning_pause_user_started on learning_pause (created_by, started_at) where is_deleted = false;
