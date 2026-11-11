-- Boop B1 (mezo-r36n9.11): a multi-day / all-day event is sent under several days with the same
-- EventKit id, so the key is (owner, external id, date).
alter table calendar_event drop constraint uq_calendar_event_owner_external;
alter table calendar_event add constraint uq_calendar_event_owner_external_date unique (created_by, external_id, date);
