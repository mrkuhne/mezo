-- Persisted weekly score + 8-week trend (bd mezo-d20.7.5, handoff 2026-08-28 §6.3). The weekly
-- score is DETERMINISTIC (DayScoreService), the weekly review narrative is not — so the score
-- lives in its own small table rather than as columns on weekly_review: an empty week or a
-- failed LLM call leaves no review row, but must still be able to carry a score. This row is a
-- CACHE, not a truth (a retroactive log changes the score), hence computed_at: the trend read
-- refreshes any row whose week saw a log written after that stamp.
-- Shape mirrors weekly_review (202608271200_mezo-p2tr_create_weekly_review.sql), partial unique
-- included, so a soft-deleted row can be re-created when a score reappears.

create table weekly_score (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    week_start   date        not null,
    score        integer     not null,
    sleep_avg    numeric(5,2),
    fuel_avg     numeric(5,2),
    checkin_avg  numeric(5,2),
    activity_avg numeric(5,2),
    computed_at  timestamptz not null,
    constraint pk_weekly_score_id primary key (id),
    constraint fk_weekly_score_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_weekly_score_score_range check (score between 0 and 100),
    constraint ck_weekly_score_sleep_avg_range check (sleep_avg is null or sleep_avg between 0 and 100),
    constraint ck_weekly_score_fuel_avg_range check (fuel_avg is null or fuel_avg between 0 and 100),
    constraint ck_weekly_score_checkin_avg_range check (checkin_avg is null or checkin_avg between 0 and 100),
    constraint ck_weekly_score_activity_avg_range check (activity_avg is null or activity_avg between 0 and 100)
);

create unique index uq_weekly_score_created_by_week_start
    on weekly_score (created_by, week_start) where is_deleted = false;

-- The trend read walks a contiguous window of weeks backwards from one Monday.
create index idx_weekly_score_created_by_week_start
    on weekly_score (created_by, week_start desc) where is_deleted = false;
