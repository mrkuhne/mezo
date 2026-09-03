-- lint-liquibase: allow-insert
-- Multi-user accounts S4 (mezo-qw37.4): split pantry_item into a SHARED definition catalog
-- (pantry_catalog: what a food/supplement IS) and PER-USER state (pantry_item: what I have of it).
-- pantry_item keeps its id, so the four ON DELETE RESTRICT FKs (meal_item, recipe_ingredient,
-- protocol_item, supplement_intake) and pantry_import's SET NULL FK are untouched.
-- The INSERTs below are a backfill of EXISTING rows (dedupe by natural key), not seed data.
-- Spec: docs/superpowers/specs/2026-09-02-multi-user-accounts-design.md §8.

-- 1. The catalog. created_by NULL = loader master (seed/pantry-catalog.json); set = user-authored,
--    visible to everyone (K1). ON DELETE SET NULL: a deleted author's definitions must survive for
--    the other users whose pantry_item rows point at them. No @SQLRestriction on the entity side —
--    a soft-deleted catalog row stays loadable through an item's FK and revivable by the loader.
create table pantry_catalog (
    id              uuid         not null default gen_random_uuid(),
    created_by      uuid,
    is_deleted      boolean      not null default false,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz,
    kind            text         not null,
    name            text         not null,
    brand           text,
    source          text         not null default 'manual',
    category        text,
    serving_amount  numeric,
    serving_unit    text,
    kcal            numeric,
    protein_g       numeric,
    carbs_g         numeric,
    fat_g           numeric,
    fiber_g         numeric,
    sugar_g         numeric,
    salt_g          numeric,
    saturated_fat_g numeric,
    package_label   text,
    micros          jsonb,
    nova            smallint,
    form            text,
    caffeine        boolean,
    constraint pk_pantry_catalog_id primary key (id),
    constraint fk_pantry_catalog_created_by_app_user_id foreign key (created_by) references app_user (id) on delete set null,
    constraint ck_pantry_catalog_kind check (kind in ('food','supplement','stim','med')),
    constraint ck_pantry_catalog_source check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
                      'gymbeam.hu','web','photo')),
    constraint ck_pantry_catalog_category check (category is null or category in (
        'vegetables','fruits','meat','fish','eggs','dairy','cheese','legumes','grains',
        'pasta','bakery','nuts_seeds','oils_fats','condiments','snacks','beverages','supplement','other')),
    constraint ck_pantry_catalog_nova check (nova is null or nova between 1 and 4)
);

-- Natural key: case-insensitive name + brand (brand-less rows share the '' bucket).
create unique index uq_pantry_catalog_natural on pantry_catalog (lower(name), lower(coalesce(brand, '')));
create index idx_pantry_catalog_created_by on pantry_catalog (created_by);
create index idx_pantry_catalog_kind on pantry_catalog (kind);

-- 2. Pre-flight guard. After the split one user may hold ONE live row per definition
--    (uq_pantry_item_created_by_catalog_id below). If a user today has two live rows with the
--    same name+brand, this throwaway unique index fails with "could not create unique index",
--    the changeset rolls back and the app refuses to start — resolve the duplicates by hand
--    (find them with the query below; docs/features/pantry.md §9 will carry the same diagnostic
--    once Task 12 lands it) rather than let the migration pick one:
--
--    select created_by, lower(name), lower(coalesce(brand,'')), count(*), array_agg(id)
--    from pantry_item
--    where is_deleted = false
--    group by 1,2,3
--    having count(*) > 1;
create unique index uq_pantry_item_split_guard
    on pantry_item (created_by, lower(name), lower(coalesce(brand, ''))) where is_deleted = false;
drop index uq_pantry_item_split_guard;

-- 3. One catalog row per natural key from the LIVE items; the earliest created_at (then id) wins
--    and becomes the author. Every other live row with that key binds to the winner in step 5.
insert into pantry_catalog (created_by, is_deleted, created_at, kind, name, brand, source, category,
    serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g,
    saturated_fat_g, package_label, micros, nova, form, caffeine)
select distinct on (lower(name), lower(coalesce(brand, '')))
       created_by, false, created_at, kind, name, brand, source, category,
       serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g,
       saturated_fat_g, package_label, micros, nova, form, caffeine
from pantry_item
where is_deleted = false
order by lower(name), lower(coalesce(brand, '')), created_at asc, id asc;

-- 4. Soft-deleted items need a catalog_id too (NOT NULL). Those whose key already exists bind to
--    the live row in step 5; the rest get an is_deleted=true catalog row of their own.
insert into pantry_catalog (created_by, is_deleted, created_at, kind, name, brand, source, category,
    serving_amount, serving_unit, kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g,
    saturated_fat_g, package_label, micros, nova, form, caffeine)
select distinct on (lower(d.name), lower(coalesce(d.brand, '')))
       d.created_by, true, d.created_at, d.kind, d.name, d.brand, d.source, d.category,
       d.serving_amount, d.serving_unit, d.kcal, d.protein_g, d.carbs_g, d.fat_g, d.fiber_g, d.sugar_g,
       d.salt_g, d.saturated_fat_g, d.package_label, d.micros, d.nova, d.form, d.caffeine
from pantry_item d
where d.is_deleted = true
  and not exists (select 1 from pantry_catalog c
                   where lower(c.name) = lower(d.name)
                     and lower(coalesce(c.brand, '')) = lower(coalesce(d.brand, '')))
order by lower(d.name), lower(coalesce(d.brand, '')), d.created_at asc, d.id asc;

-- 5. Backfill the link (nullable -> backfill -> NOT NULL -> constrain: the Citus recipe, spec §13).
alter table pantry_item add column catalog_id uuid;
update pantry_item i
   set catalog_id = c.id
  from pantry_catalog c
 where lower(c.name) = lower(i.name)
   and lower(coalesce(c.brand, '')) = lower(coalesce(i.brand, ''));
alter table pantry_item alter column catalog_id set not null;
alter table pantry_item add constraint fk_pantry_item_catalog_id_pantry_catalog_id
    foreign key (catalog_id) references pantry_catalog (id) on delete restrict;
create index idx_pantry_item_catalog_id on pantry_item (catalog_id);
create unique index uq_pantry_item_created_by_catalog_id
    on pantry_item (created_by, catalog_id) where is_deleted = false;

-- 6. One-way safety net for the S4 definition merge: the dedupe in steps 3-4 collapses
--    definitions across all users (earliest created_at wins), so every other user's and every
--    soft-deleted row's divergent kcal/macros/micros/serving/source values are about to be
--    destroyed by the column drop below with no rollback block in this repo. Snapshot them here,
--    before the drop, while the columns still exist. May be dropped by a later cleanup changeset
--    once the split is proven in production.
create table pantry_item_definition_archive as
select id, created_by, kind, name, brand, source, category, serving_amount, serving_unit,
       kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, salt_g, saturated_fat_g,
       package_label, micros, nova, form, caffeine
from pantry_item;

-- 7. The definition columns leave pantry_item (their CHECKs and the kind index go first).
drop index idx_pantry_item_created_by_kind;
alter table pantry_item drop constraint ck_pantry_item_kind;
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item drop constraint ck_pantry_item_nova;
alter table pantry_item drop constraint ck_pantry_item_category;
alter table pantry_item
    drop column kind,
    drop column name,
    drop column brand,
    drop column source,
    drop column category,
    drop column serving_amount,
    drop column serving_unit,
    drop column kcal,
    drop column protein_g,
    drop column carbs_g,
    drop column fat_g,
    drop column fiber_g,
    drop column sugar_g,
    drop column salt_g,
    drop column saturated_fat_g,
    drop column package_label,
    drop column micros,
    drop column nova,
    drop column form,
    drop column caffeine;
