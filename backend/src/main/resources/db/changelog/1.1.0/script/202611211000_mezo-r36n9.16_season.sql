-- Boop B6 Évad S1 (mezo-r36n9.16): the season — one N-week plan that owns its goal (1:1), writes the weekly
-- gym + sport slots and the sleep need on accept, and attaches its training block through the existing
-- goal_plan_link. One ACTIVE season per owner (planned and closed ones are kept). `draft` is the season as
-- last accepted, in the contract's SeasonDraft shape (the phone's Módosítás page starts from it);
-- `sleep_base_min` is the sleep goal minutes before the season took the sleep need over (the base of the rule).
create table season (
    id                       uuid          not null default gen_random_uuid(),
    created_by               uuid          not null,
    is_deleted               boolean       not null default false,
    created_at               timestamptz   not null default now(),
    updated_at               timestamptz   not null default now(),
    title                    varchar(80)   not null,
    status                   varchar(10)   not null,
    start_date               date          not null,
    weeks                    smallint      not null,
    goal_id                  uuid          not null,
    sleep_need_min           integer,
    sleep_base_min           integer,
    processed_food_max_nova  smallint      not null default 2,
    deload_maintain          boolean       not null default true,
    use_learned_expenditure  boolean       not null default true,
    propose_experiments      boolean       not null default true,
    menu_day                 smallint      default 6,
    menu_time                varchar(5)    not null default '18:00',
    draft                    jsonb,
    closed_summary           jsonb,
    constraint pk_season_id primary key (id),
    constraint fk_season_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_season_goal_id_goal_id foreign key (goal_id) references goal (id) on delete cascade,
    constraint ck_season_status check (status in ('planned', 'active', 'closed')),
    constraint ck_season_weeks check (weeks between 4 and 24),
    constraint ck_season_processed_food_max_nova check (processed_food_max_nova between 1 and 4),
    constraint ck_season_menu_day check (menu_day is null or menu_day between 0 and 6),
    constraint ck_season_sleep_need_min check (sleep_need_min is null or sleep_need_min between 1 and 1440),
    constraint ck_season_sleep_base_min check (sleep_base_min is null or sleep_base_min between 1 and 1440)
);
create index idx_season_created_by on season (created_by) where is_deleted = false;
create unique index uq_season_one_active on season (created_by) where status = 'active' and is_deleted = false;

-- The recipes the season allows (the weekly menu, S3, draws only from these). Replaced as a whole on accept.
create table season_allowed_recipe (
    season_id   uuid          not null,
    recipe_id   uuid          not null,
    created_by  uuid          not null,
    created_at  timestamptz   not null default now(),
    constraint pk_season_allowed_recipe_id primary key (season_id, recipe_id),
    constraint fk_season_allowed_recipe_season_id_season_id foreign key (season_id) references season (id) on delete cascade,
    constraint fk_season_allowed_recipe_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);

-- One row per accepted change (activate / apply): the draft and the before / after numbers of its preview.
create table season_revision (
    id          uuid          not null default gen_random_uuid(),
    created_by  uuid          not null,
    is_deleted  boolean       not null default false,
    created_at  timestamptz   not null default now(),
    updated_at  timestamptz   not null default now(),
    season_id   uuid          not null,
    draft       jsonb         not null,
    before      jsonb,
    after       jsonb,
    constraint pk_season_revision_id primary key (id),
    constraint fk_season_revision_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_season_revision_season_id_season_id foreign key (season_id) references season (id) on delete cascade
);
create index idx_season_revision_season_id on season_revision (season_id) where is_deleted = false;
