-- Boop B4 (mezo-r36n9.14): idempotent writes from the phone's offline outbox. A retried request carries the
-- same client_ref, so it can never duplicate a meal, a water log or a supplement intake. Unique per owner among
-- live rows only (same shape as B3's intention_focus/journal_entry); rows without a ref (the web, and every
-- existing row) are outside the partial index, so NULLs never collide.
alter table meal add column client_ref uuid;
create unique index uq_meal_created_by_client_ref on meal (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

alter table water_log add column client_ref uuid;
create unique index uq_water_log_created_by_client_ref on water_log (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

alter table supplement_intake add column client_ref uuid;
create unique index uq_supplement_intake_created_by_client_ref on supplement_intake (created_by, client_ref)
    where client_ref is not null and is_deleted = false;
