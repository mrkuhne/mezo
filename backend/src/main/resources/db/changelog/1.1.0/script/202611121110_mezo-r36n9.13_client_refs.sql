-- Boop B3 (mezo-r36n9.13): idempotent writes from the phone's outbox. A retried request carries the same
-- client_ref, so it can never duplicate a goal (intention_focus) or a journal entry. Unique per owner among
-- live rows only; rows without a ref (the web) are untouched.
alter table intention_focus add column client_ref uuid;
create unique index uq_intention_focus_created_by_client_ref on intention_focus (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

alter table journal_entry add column client_ref uuid;
create unique index uq_journal_entry_created_by_client_ref on journal_entry (created_by, client_ref)
    where client_ref is not null and is_deleted = false;

-- Journal source gains 'boop' (entries captured in the native app); the constraint keeps its name.
alter table journal_entry drop constraint ck_journal_entry_source;
alter table journal_entry add constraint ck_journal_entry_source check (source in ('quickinput', 'ritual', 'boop'));
