-- Photo import (mezo-d8tr): widen the source allow-lists with the 'photo' provenance.
-- Kept in lockstep with the PantrySource contract enum (defensive mapper: mezo-w3o).
alter table pantry_item drop constraint ck_pantry_item_source;
alter table pantry_item add  constraint ck_pantry_item_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
                      'gymbeam.hu','web','photo'));

alter table pantry_import drop constraint ck_pantry_import_source;
alter table pantry_import add  constraint ck_pantry_import_source
    check (source in ('kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
                      'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
                      'gymbeam.hu','web','photo'));
