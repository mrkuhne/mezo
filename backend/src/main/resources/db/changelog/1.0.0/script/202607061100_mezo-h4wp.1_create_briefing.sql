-- Proactive layer B1.1 (bd mezo-h4wp.1, roadmap §B1.1).
-- One generated morning briefing per user+day; content is a typed jsonb envelope
-- (eyebrow + body paragraphs + model-SELECTED refs) mirroring the FE Briefing shape.

create table briefing (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    briefing_date date        not null,
    content       jsonb       not null,
    generated_at  timestamptz not null,
    constraint pk_briefing_id primary key (id),
    constraint fk_briefing_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

-- Partial UNIQUE (the daily_summary precedent): one LIVE briefing per user+day; a soft-deleted
-- row does not block regeneration (B1.2's staleness path = soft-delete + insert). Doubles as
-- the lookup index (every query filters is_deleted = false via @SQLRestriction).
create unique index uq_briefing_created_by_briefing_date
    on briefing (created_by, briefing_date) where is_deleted = false;
