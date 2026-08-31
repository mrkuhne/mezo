-- Karakter S4 monthly deep read (bd mezo-1gim.6, fix round 1): the app-level check-then-insert
-- idempotency guard in CharacterMonthlyService is not itself race-safe. uq_character_conference_weekly
-- (202608272000_mezo-1gim.1) already covers WEEKLY the same way — this is that same partial unique
-- index for MONTHLY, so a live row per (owner, month) is enforced at the DB level too.

create unique index uq_character_conference_monthly
    on character_conference (created_by, week_start) where is_deleted = false and kind = 'MONTHLY';
