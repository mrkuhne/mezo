-- Daily evaluation slice (mezo-jcpt.4): day_review is the LLM prose layer's cache table.
-- The 6-dimension score (DayEvaluationEngine, DayScoreService) is deterministic and lives
-- elsewhere; this table caches the (comparatively expensive) narrative/highlights/adjustment
-- layer keyed by inputs_hash, so a day's numbers can be re-rendered without asking the LLM
-- again, and a genuinely changed day (retroactive log edit) invalidates by hash mismatch
-- rather than by row deletion. Shape mirrors weekly_score (202608291200) — a partial unique
-- index (soft-delete aware) rather than a plain unique constraint, so a soft-deleted row does
-- not block regeneration.

create table day_review (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    date         date        not null,
    envelope     jsonb       not null,
    inputs_hash  varchar(64) not null,
    computed_at  timestamptz not null,
    constraint pk_day_review_id primary key (id),
    constraint fk_day_review_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

create unique index uq_day_review_created_by_date
    on day_review (created_by, date) where is_deleted = false;
