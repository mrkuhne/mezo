-- Fuel Recipes (mezo-lns): a recipe aggregate (recipe + ordered recipe_ingredient lines).
-- Both tables are OWNED (created_by FK -> app_user, soft-delete via is_deleted).
-- recipe_ingredient carries a denormalized snapshot of the pantry_item at write time so a
-- later edit/delete of the pantry_item never silently rewrites historical recipe macros.

create table recipe (
    id            uuid         not null default gen_random_uuid(),
    created_by    uuid         not null,
    is_deleted    boolean      not null default false,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz,
    name          text         not null,
    slot          text,
    category      text         not null,
    servings      integer      not null default 1,
    prep_mins     integer,
    cook_mins     integer,
    tags          jsonb,
    starred       boolean      not null default false,
    nova_dominant smallint,
    fit_score     numeric,
    fits_for      jsonb,
    constraint pk_recipe_id primary key (id),
    constraint fk_recipe_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_recipe_category check (category in ('breakfast','lunch','dinner','snack')),
    constraint ck_recipe_servings check (servings >= 1),
    constraint ck_recipe_prep_mins check (prep_mins is null or prep_mins >= 0),
    constraint ck_recipe_cook_mins check (cook_mins is null or cook_mins >= 0),
    constraint ck_recipe_nova_dominant check (nova_dominant is null or nova_dominant between 1 and 4)
);

create index idx_recipe_created_by on recipe (created_by);
create index idx_recipe_created_by_category on recipe (created_by, category);

create table recipe_ingredient (
    id                 uuid         not null default gen_random_uuid(),
    created_by         uuid         not null,
    is_deleted         boolean      not null default false,
    created_at         timestamptz  not null default now(),
    recipe_id          uuid         not null,
    pantry_item_id     uuid         not null,
    amount             numeric      not null,
    unit               text         not null,
    note               text,
    line_order         integer      not null,
    snapshot_name      text         not null,
    snapshot_per       numeric      not null,
    snapshot_basis_unit text        not null,
    snapshot_kcal      numeric      not null,
    snapshot_protein_g numeric      not null,
    snapshot_carbs_g   numeric      not null,
    snapshot_fat_g     numeric      not null,
    constraint pk_recipe_ingredient_id primary key (id),
    constraint fk_recipe_ingredient_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_recipe_ingredient_recipe_id_recipe_id foreign key (recipe_id) references recipe (id) on delete cascade,
    constraint fk_recipe_ingredient_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict,
    constraint ck_recipe_ingredient_amount check (amount > 0)
);

create index idx_recipe_ingredient_recipe_id on recipe_ingredient (recipe_id);
create index idx_recipe_ingredient_created_by on recipe_ingredient (created_by);
create index idx_recipe_ingredient_pantry_item_id on recipe_ingredient (pantry_item_id);
