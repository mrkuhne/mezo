-- Boop B1 (mezo-r36n9.11): calendar events become history keyed by the device's item id.
alter table calendar_event add column external_id varchar(200);
alter table calendar_event add column updated_at  timestamptz not null default now();
update calendar_event set external_id = 'legacy-' || id where external_id is null;
alter table calendar_event alter column external_id set not null;
alter table calendar_event add constraint uq_calendar_event_owner_external unique (created_by, external_id);
