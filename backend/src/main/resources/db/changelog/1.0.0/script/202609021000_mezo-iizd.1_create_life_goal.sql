-- Életcél-rendszer 1. szelet (mezo-iizd.1): a life goal, its 2–5 pillars and the per-pillar
-- daily evaluation row (written by the slice-2 nightly job; created now so the contract is whole).
create table life_goal (
    id                  uuid        not null default gen_random_uuid(),
    created_by          uuid        not null,
    is_deleted          boolean     not null default false,
    created_at          timestamptz not null default now(),
    title               text        not null,
    why_text            text,
    frame               text        not null default 'unset',
    dimension           text        not null,
    secondary_dimension text,
    status              text        not null default 'draft',
    start_date          date        not null,
    target_date         date,
    activated_at        timestamptz,
    closed_at           timestamptz,
    obstacle_text       text,
    if_then_plans       jsonb       not null default '[]'::jsonb,
    constraint pk_life_goal primary key (id),
    constraint fk_life_goal_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_life_goal_frame check (frame in ('intrinsic', 'extrinsic', 'unset')),
    constraint ck_life_goal_dimension check (dimension in
        ('positive_emotion', 'engagement', 'relationships', 'meaning', 'accomplishment', 'health')),
    constraint ck_life_goal_secondary_dimension check (secondary_dimension is null or secondary_dimension in
        ('positive_emotion', 'engagement', 'relationships', 'meaning', 'accomplishment', 'health')),
    constraint ck_life_goal_status check (status in ('draft', 'active', 'parked', 'done', 'archived')),
    constraint ck_life_goal_target_after_start check (target_date is null or target_date >= start_date)
);
create index idx_life_goal_created_by_status on life_goal (created_by, status) where is_deleted = false;

create table life_goal_pillar (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    goal_id     uuid        not null,
    label       text        not null,
    skill_key   text        not null,
    kind        text        not null,
    weight      smallint    not null default 1,
    position    smallint    not null default 0,
    is_active   boolean     not null default true,
    source      jsonb       not null,
    rule        jsonb       not null default '{}'::jsonb,
    constraint pk_life_goal_pillar primary key (id),
    constraint fk_life_goal_pillar_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_life_goal_pillar_goal_id_life_goal_id
        foreign key (goal_id) references life_goal (id) on delete cascade,
    constraint ck_life_goal_pillar_kind check (kind in ('habit', 'average', 'target', 'baseline', 'linked')),
    constraint ck_life_goal_pillar_weight check (weight between 1 and 3)
);
create index idx_life_goal_pillar_goal_id on life_goal_pillar (goal_id) where is_deleted = false;

create table life_goal_pillar_day (
    id          uuid        not null default gen_random_uuid(),
    created_by  uuid        not null,
    is_deleted  boolean     not null default false,
    created_at  timestamptz not null default now(),
    pillar_id   uuid        not null,
    day         date        not null,
    value       numeric(12, 3),
    target      numeric(12, 3),
    baseline    numeric(12, 3),
    status      text        not null,
    computed_at timestamptz not null default now(),
    constraint pk_life_goal_pillar_day primary key (id),
    constraint fk_life_goal_pillar_day_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_life_goal_pillar_day_pillar_id_life_goal_pillar_id
        foreign key (pillar_id) references life_goal_pillar (id) on delete cascade,
    constraint ck_life_goal_pillar_day_status check (status in ('hit', 'partial', 'miss', 'no_data'))
);
create unique index uq_life_goal_pillar_day_pillar_day
    on life_goal_pillar_day (pillar_id, day) where is_deleted = false;
