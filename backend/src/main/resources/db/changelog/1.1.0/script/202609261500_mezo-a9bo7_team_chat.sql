-- Csapatfal Act III (spec 2026-09-26 §5.1) — mezo-a9bo7.21: the all-day team chat thread
-- (an "ügy") and its lines. Columns follow the OwnedEntity convention used throughout this
-- schema (is_deleted, no updated_at) rather than the brief's literal "deleted"/"updated_at" —
-- see task-3-report.md for the noted deviation.
create table team_chat_thread (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    flag_key varchar(24) not null,
    owner_character varchar(16) not null,
    guest_character varchar(16),
    advice_key varchar(64),            -- the library entry picked at open (feedback + priority)
    status varchar(10) not null,
    opened_at timestamptz not null,
    closed_at timestamptz,
    pushed boolean not null default false,
    actions jsonb,                      -- offered AdviceActionCatalog actions
    applied jsonb,                      -- {actionKey, at} once applied
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    constraint pk_team_chat_thread_id primary key (id),
    constraint fk_team_chat_thread_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint ck_team_chat_thread_status check (status in ('OPEN','RESOLVED','EXPIRED'))
);
create unique index uq_team_chat_thread_open on team_chat_thread (created_by, flag_key)
    where status = 'OPEN' and is_deleted = false;
create index ix_team_chat_thread_owner_opened on team_chat_thread (created_by, opened_at desc);

create table team_chat_line (
    id uuid not null default gen_random_uuid(),
    created_by uuid not null,
    thread_id uuid references team_chat_thread(id),
    kind varchar(8) not null,
    character varchar(16),              -- null for USER
    body text not null,
    voiced boolean not null default false,
    facts jsonb,                        -- the whitelist the line was written from
    occurred_at timestamptz not null,
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    constraint pk_team_chat_line_id primary key (id),
    constraint fk_team_chat_line_created_by foreign key (created_by) references app_user(id) on delete cascade,
    constraint ck_team_chat_line_kind check (kind in ('OPEN','GUEST','RESOLVE','SKEPTIC','USER'))
);
create index ix_team_chat_line_owner_time on team_chat_line (created_by, occurred_at);
create unique index uq_team_chat_line_resolve on team_chat_line (thread_id) where kind = 'RESOLVE';
