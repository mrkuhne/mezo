-- Fuel Meal-logging (mezo-arb): a meal aggregate (meal + ordered, polymorphic meal_item lines).
-- Both tables are OWNED (created_by FK -> app_user, soft-delete via is_deleted).
-- meal_item is polymorphic: each line references a recipe OR a pantry_item (source discriminator
-- + the ck_meal_item_arm exactly-one-of CHECK). It carries a denormalized snapshot of the source's
-- name + per-basis macros at write time so a later edit/delete of the source never silently
-- rewrites historical meal macros (identical rationale to recipe_ingredient).

create table meal (
    id         uuid         not null default gen_random_uuid(),
    created_by uuid         not null,
    is_deleted boolean      not null default false,
    created_at timestamptz  not null default now(),
    updated_at timestamptz,
    logged_at  timestamptz  not null,
    meal_date  date         not null,
    slot       text         not null,
    title      text,
    breakdown  jsonb,
    constraint pk_meal_id primary key (id),
    constraint fk_meal_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_meal_slot check (slot in ('breakfast','lunch','dinner','snack'))
);

create index idx_meal_created_by on meal (created_by);
create index idx_meal_created_by_meal_date on meal (created_by, meal_date);

create table meal_item (
    id                  uuid         not null default gen_random_uuid(),
    created_by          uuid         not null,
    is_deleted          boolean      not null default false,
    created_at          timestamptz  not null default now(),
    meal_id             uuid         not null,
    line_order          integer      not null,
    source              text         not null,
    recipe_id           uuid,
    pantry_item_id      uuid,
    amount              numeric      not null,
    unit                text         not null,
    snapshot_name       text         not null,
    snapshot_per        numeric      not null,
    snapshot_basis_unit text         not null,
    snapshot_kcal       numeric      not null,
    snapshot_protein_g  numeric      not null,
    snapshot_carbs_g    numeric      not null,
    snapshot_fat_g      numeric      not null,
    snapshot_nova       smallint,
    constraint pk_meal_item_id primary key (id),
    constraint fk_meal_item_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_meal_item_meal_id_meal_id foreign key (meal_id) references meal (id) on delete cascade,
    constraint fk_meal_item_recipe_id_recipe_id foreign key (recipe_id) references recipe (id) on delete restrict,
    constraint fk_meal_item_pantry_item_id_pantry_item_id foreign key (pantry_item_id) references pantry_item (id) on delete restrict,
    constraint ck_meal_item_source check (source in ('recipe','pantry')),
    constraint ck_meal_item_amount check (amount > 0),
    constraint ck_meal_item_snapshot_nova check (snapshot_nova is null or snapshot_nova between 1 and 4),
    constraint ck_meal_item_arm check (
        (source = 'recipe' and recipe_id is not null and pantry_item_id is null)
        or (source = 'pantry' and pantry_item_id is not null and recipe_id is null)
    )
);

create index idx_meal_item_meal_id on meal_item (meal_id);
create index idx_meal_item_created_by on meal_item (created_by);
create index idx_meal_item_recipe_id on meal_item (recipe_id);
create index idx_meal_item_pantry_item_id on meal_item (pantry_item_id);
