-- Extend pantry_item for the imported catalog: extra nutrition facts, richer category enum,
-- and additional vendor sources. Additive + constraint-swap only (no data rewrite).
alter table pantry_item add column fiber_g         numeric;
alter table pantry_item add column sugar_g         numeric;
alter table pantry_item add column salt_g          numeric;
alter table pantry_item add column saturated_fat_g numeric;

-- Extend the source allow-list with the catalog's vendors.
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item add  constraint ck_pantry_item_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon'));

-- Category is now an enum (was free text); null stays allowed (manual items may omit it).
alter table pantry_item add constraint ck_pantry_item_category
    check (category is null or category in (
        'vegetables','fruits','meat','fish','eggs','dairy','cheese','legumes','grains',
        'pasta','bakery','nuts_seeds','oils_fats','condiments','snacks','beverages','supplement','other'));
