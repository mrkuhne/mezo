-- Boop Pénz — the weekly long-horizon review (mezo-r36n9.120). One live row per owner and complete Monday–Sunday
-- week (week_start = that Monday in his money timezone), built from the week's stored daily digests by the news run.
-- status: ready (at least one sleeve had stories) | quiet (none did) | failed (the build itself broke; the next run
-- rebuilds it). sections: the three sleeve sections, contract-shaped (PenzWeeklySectionJson).
create table penz_weekly_review (
    id             uuid          not null default gen_random_uuid(),
    created_by     uuid          not null,
    is_deleted     boolean       not null default false,
    created_at     timestamptz   not null default now(),
    updated_at     timestamptz   not null default now(),
    week_start     date          not null,
    status         varchar(6)    not null,
    sections       jsonb         not null default '[]',
    generated_at   timestamptz   not null,
    constraint pk_penz_weekly_review_id primary key (id),
    constraint fk_penz_weekly_review_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_penz_weekly_review_status check (status in ('ready', 'quiet', 'failed')),
    constraint ck_penz_weekly_review_week_start_monday check (extract(isodow from week_start) = 1)
);
create unique index uq_penz_weekly_review_created_by_week_start on penz_weekly_review (created_by, week_start) where is_deleted = false;
