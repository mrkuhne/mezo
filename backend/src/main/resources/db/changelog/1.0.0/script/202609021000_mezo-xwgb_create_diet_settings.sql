-- mezo-xwgb (Diet Plan slice 1, spec docs/superpowers/specs/2026-09-02-diet-plan-design.md).
-- Per-user diet-preference singleton (fuel_settings shape): macro split preset / custom P/C/F
-- tenths-of-percent / protein g-per-kg tier / water + fiber targets. No backfill: the absent row
-- resolves to the config ghost (balanced / moderate / 4000 / 30), which reproduces the previous
-- hardcoded behavior exactly.

create table diet_settings (
    id              uuid        not null default gen_random_uuid(),
    created_by      uuid        not null,
    is_deleted      boolean     not null default false,
    created_at      timestamptz not null default now(),
    split_preset    varchar(16) not null,
    protein_pct_x10 integer,
    carbs_pct_x10   integer,
    fat_pct_x10     integer,
    protein_tier    varchar(16) not null,
    water_ml        integer     not null,
    fiber_g         integer     not null,
    constraint pk_diet_settings_id primary key (id),
    constraint fk_diet_settings_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_diet_settings_split_preset check (split_preset in ('balanced', 'low_fat', 'low_carb', 'high_carb', 'custom')),
    constraint ck_diet_settings_protein_tier check (protein_tier in ('moderate', 'high')),
    constraint ck_diet_settings_water_ml check (water_ml between 500 and 8000),
    constraint ck_diet_settings_fiber_g check (fiber_g between 10 and 80)
);
create unique index uq_diet_settings_user on diet_settings (created_by) where is_deleted = false;
