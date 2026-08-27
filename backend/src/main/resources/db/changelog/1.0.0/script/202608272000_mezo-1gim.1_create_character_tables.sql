-- Karakter dossier spine (bd mezo-1gim.1, spec 2026-08-27-user-character-dossier-design §4):
-- 5 tables. character_dimension = 7 lazily-seeded CORE rows + AI-opened CHAPTER rows;
-- claims carry confidence + typed jsonb evidence/feedback/history; observations are the
-- nightly experts' output consumed by conferences; conferences persist the real multi-turn
-- konzílium transcript; portrait revisions back the future "Történet" view.

create table character_dimension (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    key         varchar(40) not null,
    title       varchar(80) not null,
    kind        varchar(10) not null,
    expert_key  varchar(40),
    portrait    text        not null default '',
    maturity    smallint    not null default 0,
    version     int         not null default 0,
    updated_at  timestamptz not null default now(),
    constraint pk_character_dimension_id primary key (id),
    constraint fk_character_dimension_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_dimension_kind check (kind in ('CORE', 'CHAPTER')),
    constraint ck_character_dimension_maturity check (maturity between 0 and 100)
);

create unique index uq_character_dimension_created_by_key
    on character_dimension (created_by, key) where is_deleted = false;

create table character_claim (
    id                    uuid          not null default gen_random_uuid(),
    created_by            uuid          not null,
    is_deleted            boolean       not null default false,
    created_at            timestamptz   not null default now(),
    dimension_id          uuid          not null,
    text                  text          not null,
    confidence            numeric(3, 2) not null,
    status                varchar(10)   not null,
    origin_conference_id  uuid,
    proposed_by           varchar(40)   not null,
    evidence              jsonb         not null,
    sensitive             boolean       not null default false,
    user_feedback         jsonb         not null,
    confidence_history    jsonb         not null,
    updated_at            timestamptz   not null default now(),
    constraint pk_character_claim_id primary key (id),
    constraint fk_character_claim_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_character_claim_dimension_id foreign key (dimension_id) references character_dimension (id),
    constraint ck_character_claim_status check (status in ('ACTIVE', 'RETIRED')),
    constraint ck_character_claim_confidence check (confidence between 0 and 1)
);

create index idx_character_claim_dimension_id on character_claim (dimension_id);

create table character_observation (
    id                        uuid        not null default gen_random_uuid(),
    created_by                uuid        not null,
    is_deleted                boolean     not null default false,
    created_at                timestamptz not null default now(),
    expert_key                varchar(40) not null,
    dimension_keys            jsonb       not null,
    day                       date        not null,
    text                      text        not null,
    salience                  smallint    not null,
    signals                   jsonb       not null,
    consumed_by_conference_id uuid,
    constraint pk_character_observation_id primary key (id),
    constraint fk_character_observation_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_observation_salience check (salience between 1 and 5)
);

create index idx_character_observation_created_by_day on character_observation (created_by, day);

create table character_conference (
    id           uuid        not null default gen_random_uuid(),
    created_by   uuid        not null,
    is_deleted   boolean     not null default false,
    created_at   timestamptz not null default now(),
    kind         varchar(10) not null,
    week_start   date,
    transcript   jsonb       not null,
    outcome      jsonb       not null,
    generated_at timestamptz not null,
    constraint pk_character_conference_id primary key (id),
    constraint fk_character_conference_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_character_conference_kind check (kind in ('BOOTSTRAP', 'WEEKLY', 'MONTHLY'))
);

create unique index uq_character_conference_weekly
    on character_conference (created_by, week_start) where is_deleted = false and kind = 'WEEKLY';

create table character_portrait_revision (
    id            uuid        not null default gen_random_uuid(),
    created_by    uuid        not null,
    is_deleted    boolean     not null default false,
    created_at    timestamptz not null default now(),
    dimension_id  uuid        not null,
    version       int         not null,
    portrait      text        not null,
    conference_id uuid        not null,
    constraint pk_character_portrait_revision_id primary key (id),
    constraint fk_character_portrait_revision_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_character_portrait_revision_dimension_id foreign key (dimension_id) references character_dimension (id)
);

create index idx_character_portrait_revision_dimension_id on character_portrait_revision (dimension_id);
