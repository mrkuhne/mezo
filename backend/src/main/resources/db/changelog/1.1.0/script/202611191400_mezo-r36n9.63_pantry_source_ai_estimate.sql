-- „+ Kamrába" quick-add (mezo-r36n9.63): a food created from an AI estimate carries its own source value,
-- so an estimated row is recognisable (source = 'ai_estimate' and status = 'draft' is the „becsült" tag)
-- and can never be mistaken for a measured one. The allow-list is otherwise unchanged.
alter table pantry_catalog drop constraint ck_pantry_catalog_source;
alter table pantry_catalog add constraint ck_pantry_catalog_source check (source in (
    'kifli.hu','myprotein.hu','tesco.hu','auchan.hu','manual',
    'lidl','nutriversum','herbahaz','nutrifit','decathlon','openfoodfacts',
    'gymbeam.hu','web','photo','ai_estimate'));
