-- Fuel P6 (mezo-bka): pantry_import feed table + openfoodfacts source vendor.

-- Widen the source allow-list with the OpenFoodFacts import source (contract enums move in lockstep).
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item add  constraint ck_pantry_item_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts'));

-- Import activity feed: one row per confirmed import. The created pantry_item is referenced
-- loosely (SET NULL) so the feed survives item deletion.
create table pantry_import (
    id             uuid        not null default gen_random_uuid(),
    created_by     uuid        not null,
    is_deleted     boolean     not null default false,
    created_at     timestamptz not null default now(),
    source         varchar(32) not null,
    item_name      varchar(200) not null,
    item_count     integer     not null default 1,
    status         varchar(20) not null default 'synced',
    barcode        varchar(32),
    pantry_item_id uuid,
    imported_at    timestamptz not null default now(),

    constraint pk_pantry_import_id primary key (id),
    constraint fk_pantry_import_created_by_app_user_id
        foreign key (created_by) references app_user (id) on delete cascade,
    constraint fk_pantry_import_pantry_item_id
        foreign key (pantry_item_id) references pantry_item (id) on delete set null,
    constraint ck_pantry_import_source
        check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                          'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts')),
    constraint ck_pantry_import_status check (status in ('synced','manual-review')),
    constraint ck_pantry_import_item_count check (item_count > 0)
);

create index idx_pantry_import_created_by_imported_at on pantry_import (created_by, imported_at desc);
