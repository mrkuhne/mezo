-- Daily quests (bd mezo-df7q, E1 of gamified growth mezo-52vz): catalog-driven daily side quests,
-- BODY/FUELBIO slots in E1 (GROWTH activates in E2). Identity = (created_by, quest_date, slot)
-- among non-rerolled rows (partial unique — a reroll replaces the row in the same slot).
-- Also relaxes two released CHECKs additively: level_up_event.source_type += QUEST (quest XP rides
-- the idempotent award tail) and skill_progress.skill_kind += LIFE (first LIFE skill: recovery —
-- robustness is recomputed to an absolute streak target and cannot carry quest XP).

alter table level_up_event drop constraint ck_level_up_event_source_type;
alter table level_up_event add constraint ck_level_up_event_source_type
    check (source_type in ('GYM', 'SPORT', 'RUN', 'QUEST'));

alter table skill_progress drop constraint ck_skill_progress_kind;
alter table skill_progress add constraint ck_skill_progress_kind
    check (skill_kind in ('ATHLETIC', 'MUSCLE', 'LIFE'));

create table daily_quest (
    id                 uuid          not null default gen_random_uuid(),
    created_by         uuid          not null,
    is_deleted         boolean       not null default false,
    created_at         timestamptz   not null default now(),
    quest_date         date          not null,
    slot               varchar(8)    not null,
    catalog_key        varchar(60)   not null,
    skill_key          varchar(40)   not null,
    skill_kind         varchar(10)   not null,
    title              varchar(160)  not null,
    why                text          not null,
    completion_mode    varchar(10)   not null default 'DERIVED',
    target             jsonb         not null,
    xp                 integer       not null,
    coins              integer       not null default 0,
    status             varchar(10)   not null default 'offered',
    completed_at       timestamptz,
    source_activity_id uuid,
    generated_at       timestamptz   not null,
    constraint pk_daily_quest_id primary key (id),
    constraint fk_daily_quest_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_daily_quest_slot check (slot in ('BODY', 'FUELBIO', 'GROWTH')),
    constraint ck_daily_quest_skill_kind check (skill_kind in ('ATHLETIC', 'MUSCLE', 'LIFE')),
    constraint ck_daily_quest_completion_mode check (completion_mode in ('DERIVED', 'ACTIVITY')),
    constraint ck_daily_quest_status check (status in ('offered', 'completed', 'expired', 'rerolled')),
    constraint ck_daily_quest_xp check (xp >= 0)
);

create index idx_daily_quest_user_date on daily_quest (created_by, quest_date) where is_deleted = false;
create unique index uq_daily_quest_user_date_slot on daily_quest (created_by, quest_date, slot)
    where is_deleted = false and status <> 'rerolled';
