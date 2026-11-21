-- mezo-r36n9.17 (Boop B7 K1): the calendar sends every event field, so day capacity can score each event.
-- All nullable: an older phone sends none of them.
alter table calendar_event add column attendee_count integer;
alter table calendar_event add column attendee_names jsonb;
alter table calendar_event add column organizer_is_me boolean;
alter table calendar_event add column location varchar(200);
alter table calendar_event add column recurring boolean;
alter table calendar_event add column availability varchar(16);
alter table calendar_event add column notes varchar(2000);
