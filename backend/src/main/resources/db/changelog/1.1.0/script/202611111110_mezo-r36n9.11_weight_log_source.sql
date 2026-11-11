-- Boop B1 (mezo-r36n9.11): weigh-ins imported from Apple Health carry their source and HK id.
alter table weight_log add column source      varchar(16) not null default 'manual';
alter table weight_log add column external_id varchar(64);
alter table weight_log add constraint ck_weight_log_source check (source in ('manual', 'apple_health'));
create unique index uq_weight_log_owner_external on weight_log (created_by, external_id) where external_id is not null;
