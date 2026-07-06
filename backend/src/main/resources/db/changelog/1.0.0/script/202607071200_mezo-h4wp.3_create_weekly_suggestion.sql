-- Proactive W1 (bd mezo-h4wp.3, roadmap §W1): the companion's weekly plan-suggestion prose.
-- One live row per user+week (ISO Monday); regenerable data — partial unique like briefing.

create table weekly_suggestion (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    week_start   date        not null,
    prose        text        not null,
    generated_at timestamptz not null,
    constraint pk_weekly_suggestion_id primary key (id),
    constraint fk_weekly_suggestion_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_weekly_suggestion_created_by_week_start
    on weekly_suggestion (created_by, week_start) where is_deleted = false;
