-- Proactive P1 (bd mezo-h4wp.7, roadmap §P1): pattern-grounded weekly predictions + validation.
-- week_start = the generation week (ISO Monday) — the idempotence probe, NOT unique (n rows/week).
-- confidence is COPIED from the grounding pattern (null = "tanulom"); validity windows are
-- code-set; the daily validation job flips pending -> validated|missed deterministically.

create table prediction (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    week_start         date          not null,
    title              varchar(200)  not null,
    basis              text          not null,
    confidence         numeric(4,3),
    metric_key         varchar(40)   not null,
    expected_direction varchar(8)    not null,
    valid_from         date          not null,
    valid_to           date          not null,
    status             varchar(10)   not null default 'pending',
    actual             text,
    generated_at       timestamptz   not null,
    constraint pk_prediction_id primary key (id),
    constraint fk_prediction_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_prediction_expected_direction check (expected_direction in ('up', 'down', 'stable')),
    constraint ck_prediction_status check (status in ('pending', 'validated', 'missed'))
);

create index idx_prediction_created_by_week_start on prediction (created_by, week_start) where is_deleted = false;
