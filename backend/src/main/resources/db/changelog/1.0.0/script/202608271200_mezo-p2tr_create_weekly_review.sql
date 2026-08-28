-- Weekly review (bd mezo-p2tr, spec 2026-08-27): the companion's per-week "Heti elemzés"
-- narrative. One live row per user+week (ISO Monday); dayNotes/highlights = typed jsonb
-- envelopes (highlights carry code-collected, model-selected refs — the memoir anchors
-- precedent). Mirrors the memoir table's shape (202607071500_mezo-h4wp.4_create_memoir.sql).

create table weekly_review (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    week_start   date        not null,
    summary      text        not null,
    day_notes    jsonb       not null,
    highlights   jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_weekly_review_id primary key (id),
    constraint fk_weekly_review_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_weekly_review_created_by_week_start
    on weekly_review (created_by, week_start) where is_deleted = false;
