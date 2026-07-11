-- Activity log (bd mezo-jzca, E2 of gamified growth mezo-52vz): free-text life activities with
-- AI categorization onto the LIFE skill band. skill_key NULL = uncategorized (low-confidence AI
-- answer or companion off) — XP is granted at categorization time. xp_suggested stores the
-- clamped AI suggestion so a later manual categorization grants a deterministic amount.
-- Also relaxes the released level_up_event source CHECK additively: += ACTIVITY (activity XP
-- rides the same idempotent award tail; ADR 0010 consequence).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST', 'ACTIVITY'));

create table activity_log (
    id             uuid         not null default gen_random_uuid(),
    created_by     uuid         not null,
    is_deleted     boolean      not null default false,
    created_at     timestamptz  not null default now(),
    occurred_on    date         not null,
    text           text         not null,
    skill_key      varchar(40),
    confidence     numeric(4,3),
    xp_awarded     integer      not null default 0,
    xp_suggested   integer      not null default 0,
    extracted      jsonb,
    categorized_by varchar(6),
    constraint pk_activity_log_id primary key (id),
    constraint fk_activity_log_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_activity_log_categorized_by check (categorized_by in ('AI', 'USER')),
    constraint ck_activity_log_xp check (xp_awarded >= 0 and xp_suggested >= 0)
);

create index idx_activity_log_user_day on activity_log (created_by, occurred_on) where is_deleted = false;
