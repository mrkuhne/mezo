-- Boop B7 K1 day capacity (mezo-r36n9.17): scored calendar events, the owner's event labels, applied day
-- adjustments (stored BESIDE the plan — the season / gym schedule / mesocycle are never rewritten), proposals
-- and learned patterns.
create table calendar_event_score (
    id          uuid          not null default gen_random_uuid(),
    created_by  uuid          not null,
    is_deleted  boolean       not null default false,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now(),
    event_id    uuid          not null,
    input_hash  varchar(64)   not null,
    mental      smallint      not null,
    social      smallint      not null,
    physical    smallint      not null,
    restores    boolean       not null,
    kind        varchar(12)   not null,
    confidence  numeric(3,2)  not null,
    source      varchar(8)    not null,
    constraint pk_calendar_event_score_id primary key (id),
    constraint fk_calendar_event_score_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_calendar_event_score_event_id_calendar_event_id foreign key (event_id) references calendar_event (id) on delete cascade,
    constraint uq_calendar_event_score_event_hash unique (event_id, input_hash),
    constraint ck_calendar_event_score_mental check (mental between 0 and 3),
    constraint ck_calendar_event_score_social check (social between 0 and 3),
    constraint ck_calendar_event_score_physical check (physical between 0 and 3),
    constraint ck_calendar_event_score_source check (source in ('llm', 'rule'))
);

create table capacity_event_feedback (
    id          uuid          not null default gen_random_uuid(),
    created_by  uuid          not null,
    is_deleted  boolean       not null default false,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now(),
    event_key   varchar(200)  not null,
    effect      varchar(8)    not null,
    constraint pk_capacity_event_feedback_id primary key (id),
    constraint fk_capacity_event_feedback_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_capacity_event_feedback_owner_key unique (created_by, event_key),
    constraint ck_capacity_event_feedback_effect check (effect in ('drains', 'neutral', 'feeds'))
);

create table day_adjustment (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    date         date          not null,
    kind         varchar(24)   not null,
    payload      jsonb,
    bundle_id    uuid          not null,
    proposal_id  uuid,
    state        varchar(8)    not null,
    reason       text,
    client_ref   uuid          not null,
    constraint pk_day_adjustment_id primary key (id),
    constraint fk_day_adjustment_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_day_adjustment_owner_client_ref unique (created_by, client_ref),
    constraint ck_day_adjustment_state check (state in ('active', 'undone', 'waiting', 'done', 'expired'))
);
create index idx_day_adjustment_owner_date on day_adjustment (created_by, date) where is_deleted = false;

create table capacity_proposal (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    updated_at         timestamptz   not null default now(),
    week_start         date          not null,
    day                date,
    kind               varchar(24)   not null,
    bundle             jsonb         not null,
    facts              jsonb,
    effects            jsonb,
    title              text          not null,
    why                jsonb,
    generator_version  smallint      not null,
    status             varchar(9)    not null,
    decided_at         timestamptz,
    outcome            jsonb,
    constraint pk_capacity_proposal_id primary key (id),
    constraint fk_capacity_proposal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_capacity_proposal_status check (status in ('open', 'accepted', 'declined', 'ignored', 'undone', 'expired'))
);
create index idx_capacity_proposal_owner_week on capacity_proposal (created_by, week_start) where is_deleted = false;

create table capacity_pattern (
    id          uuid          not null default gen_random_uuid(),
    created_by  uuid          not null,
    is_deleted  boolean       not null default false,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now(),
    key         varchar(60)   not null,
    evidence    integer       not null,
    consistent  integer       not null,
    payload     jsonb,
    last_seen   date,
    constraint pk_capacity_pattern_id primary key (id),
    constraint fk_capacity_pattern_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint uq_capacity_pattern_owner_key unique (created_by, key)
);
