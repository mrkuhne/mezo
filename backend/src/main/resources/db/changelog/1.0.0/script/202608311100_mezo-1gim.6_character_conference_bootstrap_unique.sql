-- Karakter S4 bootstrap konzílium (bd mezo-1gim.6, final-review Finding I2): BOOTSTRAP is
-- one-time-EVER per owner (never idempotent per period, unlike WEEKLY/MONTHLY), enforced today
-- only by CharacterBootstrapService's app-level check-then-insert — not itself race-safe. Mirrors
-- uq_character_conference_monthly (202608311000_mezo-1gim.6) the same way that one mirrors
-- uq_character_conference_weekly (202608272000_mezo-1gim.1): a live row per (owner) is now
-- enforced at the DB level too.

create unique index uq_character_conference_bootstrap
    on character_conference (created_by) where is_deleted = false and kind = 'BOOTSTRAP';
