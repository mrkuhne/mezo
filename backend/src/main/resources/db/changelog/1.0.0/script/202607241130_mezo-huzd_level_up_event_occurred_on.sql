-- Business date for streak/day aggregation (mezo-huzd, spec D7). Backfill: the event's wall-clock date.
alter table level_up_event add column occurred_on date;
update level_up_event set occurred_on = (occurred_at at time zone 'Europe/Budapest')::date;
alter table level_up_event alter column occurred_on set not null;
create index idx_level_up_event_user_day
    on level_up_event (created_by, occurred_on) where is_deleted = false;
