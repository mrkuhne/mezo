-- Proactive W2 (bd mezo-h4wp.4, roadmap §W2): the weekly memoir narrative.
-- One live row per user+week (ISO Monday); anchors = typed jsonb envelope of code-collected,
-- model-selected refs (the briefing envelope precedent).

create table memoir (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    week_start   date        not null,
    title        varchar(200) not null,
    body         text        not null,
    anchors      jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_memoir_id primary key (id),
    constraint fk_memoir_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_memoir_created_by_week_start
    on memoir (created_by, week_start) where is_deleted = false;
