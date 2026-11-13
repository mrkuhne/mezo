-- Boop B4 (mezo-r36n9.14, spec §7.1): the food-sensitivity foundation.
--  * pantry_catalog.allergens — EU-14 key -> contains | traces | unknown (empty = nobody declared anything;
--    a missing key is unknown, never free-of). pantry_catalog.barcode — the product's EAN/UPC, one live row
--    per owner per barcode.
--  * recipe.allergens — the DERIVED rollup of the ingredients' states (null until first recompute).
--  * sensitivity_profile — the owner's list (allergy / intolerance / avoid) + the NOVA rule, one live row per owner.
-- NB: no bare question mark anywhere in a changeset (a JDBC placeholder); use jsonb_exists() if a key test is needed.

alter table pantry_catalog add column allergens jsonb not null default '{}'::jsonb;
alter table pantry_catalog add column barcode varchar(32);
create unique index uq_pantry_catalog_owner_barcode
    on pantry_catalog (created_by, barcode) where barcode is not null and is_deleted = false;

alter table recipe add column allergens jsonb;

create table sensitivity_profile (
    id              uuid        not null default gen_random_uuid(),
    created_by      uuid        not null,
    is_deleted      boolean     not null default false,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    items           jsonb       not null default '[]'::jsonb,
    nova_enabled    boolean     not null default true,
    nova_max_level  integer     not null default 2,
    constraint pk_sensitivity_profile_id primary key (id),
    constraint fk_sensitivity_profile_created_by_app_user_id foreign key (created_by) references app_user (id) on delete cascade,
    constraint ck_sensitivity_profile_nova_max_level check (nova_max_level between 1 and 4)
);
create unique index uq_sensitivity_profile_user on sensitivity_profile (created_by) where is_deleted = false;
