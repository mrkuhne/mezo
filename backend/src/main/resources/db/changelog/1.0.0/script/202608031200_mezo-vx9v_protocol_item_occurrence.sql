-- mezo-vx9v: occurrence-based protocol items — a stack item can appear 1..n times per day,
-- each occurrence carrying its own zone, dose and pin state. slot_key stays NULL on legacy
-- rows; ProtocolService backfills lazily on first read (seed-in-Java rule — no data in SQL).
alter table protocol_item add column slot_key text;
alter table protocol_item add column dose text;
alter table protocol_item add column pinned boolean not null default false;
alter table protocol_item add column placement_source text not null default 'rule';
alter table protocol_item add column placement_reason text;
alter table protocol_item add column rest_day_fallback text;

alter table protocol_item add constraint ck_protocol_item_slot_key
    check (slot_key is null or slot_key in
        ('wake','breakfast','pre_workout','post_workout','lunch','dinner','evening','bedtime'));
alter table protocol_item add constraint ck_protocol_item_placement_source
    check (placement_source in ('rule','llm','user','fallback'));
alter table protocol_item add constraint ck_protocol_item_rest_day_fallback
    check (rest_day_fallback is null or rest_day_fallback in
        ('skip','wake','breakfast','pre_workout','post_workout','lunch','dinner','evening','bedtime'));

-- One occurrence of a pantry item per zone (soft-deleted rows excluded so re-adding works).
create unique index uq_protocol_item_zone_occurrence
    on protocol_item (protocol_id, pantry_item_id, slot_key) where is_deleted = false;
