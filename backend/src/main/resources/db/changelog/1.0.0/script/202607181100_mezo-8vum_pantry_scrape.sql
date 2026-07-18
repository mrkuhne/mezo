-- URL-scrape import (mezo-8vum): widen the source allow-list with the scraped-vendor sources
-- (gymbeam.hu, web) on both pantry tables — contract enums move in lockstep with pantry.yml
-- PantrySource + FE pantrySources.ts (mezo-w3o) — and add scrape provenance for drafted imports.

-- Widen the source allow-list on both tables (append gymbeam.hu, web to the current P6 list).
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item add  constraint ck_pantry_item_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
                      'gymbeam.hu','web'));

alter table pantry_import drop constraint ck_pantry_import_source;
alter table pantry_import add  constraint ck_pantry_import_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
                      'gymbeam.hu','web'));

-- Scrape provenance: the product-page URL a scraped draft came from (null for OFF/manual).
alter table pantry_import add column source_url text;
