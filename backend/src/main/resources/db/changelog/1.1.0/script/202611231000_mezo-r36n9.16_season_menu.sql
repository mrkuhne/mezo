-- Boop B6 Évad S3 (mezo-r36n9.16): the weekly menu and the shopping list.
-- A menu week (Mon..Sun) is proposed (generated at the season's menu_day/menu_time or on his „Kérek másikat")
-- and becomes approved on his tap; an approved week's meals are the Étel room's day suggestions and produce the
-- shopping list. `variant` rotates the planner's choice so „Kérek másikat" gives another menu, `repeated` says the
-- allowed recipes were too few for the week without repeats.
create table season_menu_week (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    season_id    uuid          not null,
    week_start   date          not null,
    status       varchar(10)   not null,
    variant      integer       not null default 0,
    repeated     boolean       not null default false,
    approved_at  timestamptz,
    constraint pk_season_menu_week_id primary key (id),
    constraint fk_season_menu_week_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_season_menu_week_season_id_season_id foreign key (season_id) references season (id) on delete cascade,
    constraint ck_season_menu_week_status check (status in ('proposed', 'approved'))
);
create unique index uq_season_menu_week_owner_week on season_menu_week (created_by, week_start) where is_deleted = false;

-- One planned meal: the day's n-th window of a slot (the Étel day plan's own window identity), the recipe scaled to
-- the window's budget (servings 0.5–2.0 of one recipe serving), or no recipe (an ingredient-level tip in `name`).
create table season_menu_meal (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    week_id      uuid          not null,
    meal_date    date          not null,
    day_kind     varchar(12)   not null default 'pihenonap',
    sport_name   varchar(40),
    slot         varchar(10)   not null,
    ordinal      smallint      not null default 1,
    at_min       smallint      not null default 0,
    label        varchar(60)   not null,
    pre_session  boolean       not null default false,
    recipe_id    uuid,
    name         varchar(200)  not null,
    servings     numeric(4,2),
    kcal         integer       not null,
    budget_kcal  integer       not null,
    protein_g    integer,
    locked       boolean       not null default false,
    changed      boolean       not null default false,
    constraint pk_season_menu_meal_id primary key (id),
    constraint fk_season_menu_meal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_season_menu_meal_week_id_season_menu_week_id foreign key (week_id) references season_menu_week (id) on delete cascade,
    constraint ck_season_menu_meal_slot check (slot in ('breakfast', 'lunch', 'dinner', 'snack')),
    constraint ck_season_menu_meal_day_kind check (day_kind in ('edzesnap', 'sport', 'edzes_sport', 'pihenonap'))
);
create index idx_season_menu_meal_week on season_menu_meal (week_id) where is_deleted = false;
create index idx_season_menu_meal_owner_date on season_menu_meal (created_by, meal_date) where is_deleted = false;

-- The shopping list of an approved menu week (one per week; past lists are kept and readable).
create table shopping_list (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    week_id      uuid          not null,
    week_start   date          not null,
    constraint pk_shopping_list_id primary key (id),
    constraint fk_shopping_list_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_shopping_list_week_id_season_menu_week_id foreign key (week_id) references season_menu_week (id) on delete cascade
);
create unique index uq_shopping_list_week on shopping_list (week_id) where is_deleted = false;

-- One line: merged per catalog item over the week (amount in the base unit g / ml / db), its shelf group and the
-- recipes it is for. `changed` marks a line a mid-week re-fit moved; `staple` a line he added from his staples.
create table shopping_item (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    list_id      uuid          not null,
    item_key     varchar(80)   not null,
    catalog_id   uuid,
    name         varchar(200)  not null,
    amount       numeric(10,2),
    unit         varchar(10),
    shelf        varchar(20)   not null,
    for_recipes  text[]        not null default '{}',
    checked      boolean       not null default false,
    changed      boolean       not null default false,
    staple       boolean       not null default false,
    constraint pk_shopping_item_id primary key (id),
    constraint fk_shopping_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_shopping_item_list_id_shopping_list_id foreign key (list_id) references shopping_list (id) on delete cascade,
    constraint ck_shopping_item_shelf check (shelf in ('zoldseg', 'hus', 'tej', 'kamra', 'egyeb'))
);
create index idx_shopping_item_list on shopping_item (list_id) where is_deleted = false;

-- His always-at-home items (owner-level, they outlive a season): offered as chips, on the list only on his tap.
create table season_staple (
    id           uuid          not null default gen_random_uuid(),
    created_by   uuid          not null,
    is_deleted   boolean       not null default false,
    created_at   timestamptz   not null default now(),
    updated_at   timestamptz   not null default now(),
    name         varchar(80)   not null,
    position     smallint      not null default 0,
    constraint pk_season_staple_id primary key (id),
    constraint fk_season_staple_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade
);
create index idx_season_staple_owner on season_staple (created_by) where is_deleted = false;
